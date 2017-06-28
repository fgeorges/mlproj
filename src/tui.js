#!/usr/bin/env node

"use strict";

const fs      = require('fs');
const read    = require('readline-sync');
const node    = require('./node');
const program = require('./program');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The command action implementations.
 */

// start of plain commands, validate forbidden options and return platform object
function plainCmdStart(args)
{
    // check forbidden options
    [ 'dry', 'environ', 'file', 'code', 'host', 'srcdir', 'user', 'password' ].forEach(name => {
        if ( args.global[name] ) {
            throw new Error('Option `--' + name + '` not supported for command `' + args.cmd + '`');
        }
    });

    // the platform
    var verbose = args.global.verbose ? true : false;
    return new node.Platform(false, verbose);
}

// implementation of the action for command `new`
function execHelp(args, prg)
{
    // the platform (and validate options)
    let pf = plainCmdStart(args);

    // the command
    let name = args.local.cmd;
    if ( ! name ) {

        pf.log(`
   Usage:

       mlproj [options] <command> [options]

   Commands:

       help         display help about another command
       new          create a new project in the current directory
       show         display the environment
       setup        setup the environment on MarkLogic
       load         load documents to a database
       deploy       deploy modules to a database

   Global options:

       -c, --code <code>          set/override the @code
       -d, --dry, --dry-run       dry run
       -e, --environ <name>       set the environment name
       -f, --file <path>          set the environment file
       -h, --host <host>          set/override the @host
       -p, --param <name:value>   set/override a parameter value <name:value>
       -u, --user <user>          set/override the @user
       -v, --verbose              verbose mode
       -z, --password             ask for password interactively

   Command options:

       See the help of individual commands, e.g. "mlproj help load".

   Visit http://mlproj.org/ for all details.
`);
    }
    else {
        var cmd = prg.commands[name];
        if ( ! cmd ) {
            pf.log('Unknwon command: ' + name);
        }
        else {
            pf.log('');
            pf.log('   ' + cmd.desc());
            pf.log('');
            pf.log('   Usage:');
            pf.log('');
            pf.log('       mlproj ' + pf.bold(name) + ' ' + cmd.usage());
            pf.log('');
            pf.log('   ' + cmd.help);
            pf.log('');
            pf.log('   Reference:');
            pf.log('');
            pf.log('       http://mlproj.org/commands#' + name);
            pf.log('');
        }
    }
}

// implementation of the action for command `new`
function execNew(args, cmd)
{
    // the platform (and validate options)
    var display  = new node.Display();
    var platform = plainCmdStart(args);
    var dir      = platform.cwd();

    // Check the directory is empty...!
    if ( fs.readdirSync(dir).length ) {
        throw new Error('Directory is not empty: ' + dir);
    }

    // gather info by asking the user...
    platform.log('--- ' + platform.bold('Questions') + ' ---');
    var abbrev   = read.question('Project code    : ');
    var dfltName = 'http://mlproj.org/example/' + abbrev;
    var cmdArgs  = {
        dir     : dir,
        abbrev  : abbrev,
        title   : read.question('Title           : '),
        name    : read.question('Name URI (' + dfltName + '): ', { defaultInput: dfltName }),
        version : read.question('Version  (0.1.0): ', { defaultInput: '0.1.0' }),
        port    : read.question('Port     (8080) : ', { defaultInput: '8080' })
    };

    // execute the command
    var command = new (cmd.clazz())({}, cmdArgs, platform, display);
    var actions = command.prepare();
    var xpdir   = command.execute(actions);

    // summary
    platform.log('\n--- ' + platform.bold('Summary') + ' ---');
    platform.log(platform.green('✓') + ' Project created: \t' + abbrev);
    platform.log(platform.green('→') + ' Check/edit files in: \t' + xpdir);
}

// implementation of the action for any command accepting a project/environment
function execWithProject(args, cmd)
{
    // the platform
    var dry      = args.global.dry     ? true : false;
    var verbose  = args.global.verbose ? true : false;
    // TODO: Pass verbose to display instead?
    var platform = new node.Platform(dry, verbose);
    var display  = new node.Display();
    // the options
    var env      = args.global.environ;
    var path     = args.global.file;
    var base     = platform.cwd();
    var params   = args.global.param || {};
    var force    = {};
    [ 'code', 'host', 'srcdir', 'user' ].forEach(name => force[name] = args.global[name]);
    if ( args.global.password ) {
        force.password = read.question('Password: ', { hideEchoBack: true });
    }
    // the project & command
    var project = platform.project(env, path, base, params, force);
    var command = new (cmd.clazz())(args.global, args.local, platform, display, project);
    // execute the command
    var actions = command.prepare();
    command.execute(actions);
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself
 */

let prg  = program.makeProgram();
let args = prg.parse(process.argv.slice(2));

if ( ! args.cmd || args.cmd === 'help' ) {
    execHelp(args, prg);
}
else if ( args.cmd === 'new' ) {
    execNew(
        args,
        prg.commands[args.cmd]);
}
else {
    execWithProject(
        args,
        prg.commands[args.cmd]);
}
