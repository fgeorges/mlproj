#!/usr/bin/env node

"use strict";

const chalk   = require('chalk');
const fs      = require('fs');
const read    = require('readline-sync');
const node    = require('./node');
const program = require('./program');
const pkg     = require('../package.json');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The command action implementations.
 */

// start of plain commands, validate forbidden options and return platform object
function plainCmdStart(args)
{
    // check forbidden options
    [ 'dry', 'environ', 'file', 'code', 'host', 'user', 'password' ].forEach(name => {
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
   This is mlproj, version ` + pkg.version + `

   Usage:

       mlproj [options] <command> [options]

   Commands:

       help         display help about another command
       new          create a new project in the current directory
       show         display the environment
       setup        setup the environment on MarkLogic
       load         load documents to a database
       deploy       deploy modules to a database
       watch        deploy modules as soon as modified

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
            pf.log('       mlproj ' + chalk.bold(name) + ' ' + cmd.usage());
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
function execNew(args, cmd, display)
{
    // the platform (and validate options)
    var platform = plainCmdStart(args);
    var dir      = platform.cwd();

    // Check the directory is empty...!
    if ( fs.readdirSync(dir).length ) {
        if ( ! read.keyInYNStrict('Directory is not empty, do you want to continue?') ) {
            return;
        }
    }

    // gather info by asking the user...
    platform.log('--- ' + chalk.bold('Questions') + ' ---');
    var loc      = args.local;
    var abbrev   = loc.abbrev || read.question('Project code     : ');
    var dfltName = 'http://mlproj.org/example/' + abbrev;
    if ( ! loc.dir )
        loc.dir = dir;
    if ( ! loc.abbrev )
        loc.abbrev = abbrev;
    if ( ! loc.title )
        loc.title = read.question('Title            : ');
    if ( ! loc.name )
        loc.name = read.question('Name URI (' + dfltName + '): ', { defaultInput: dfltName });
    if ( ! loc.version )
        loc.version = read.question('Version  (0.1.0) : ', { defaultInput: '0.1.0' });
    if ( ! loc.port )
        loc.port = read.question('Port     (8080)  : ', { defaultInput: '8080' });

    // execute the command
    var command = new (cmd.clazz())(args.global, args.local, platform, display);
    var actions = command.prepare();
    platform.log('\n--- ' + chalk.bold('Progress') + ' ---'
           + (platform.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    actions.execute();
    platform.log('\n--- ' + chalk.bold('Summary') + ' ---'
           + (platform.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    if ( actions.done.length ) {
        platform.log(chalk.green('Done') + ':');
        platform.log(chalk.green('✓') + ' Project created: \t' + loc.abbrev);
        platform.log(chalk.green('→') + ' Check/edit files in:\t' + actions.done[0].xpdir);
    }
    if ( actions.error ) {
        platform.log(chalk.red('Error') + ':');
        platform.log(chalk.red('✗') + ' Project creation: \t' + loc.abbrev);
        platform.log(actions.error.message);
        if ( platform.verbose && actions.error.error && actions.error.error.stack ) {
            platform.log(actions.error.error.stack);
        }
    }
    if ( actions.todo.length ) {
        platform.log(chalk.yellow('Not done') + ':');
        platform.log(chalk.yellow('✗') + ' Project creation: \t' + loc.abbrev);
        platform.log(actions.error.message);
        if ( platform.verbose && actions.error.error && actions.error.error.stack ) {
            platform.log(actions.error.error.stack);
        }
    }
}

// implementation of the action for any command accepting a project/environment
function execWithProject(args, cmd, display)
{
    // the platform
    var dry      = args.global.dry     ? true : false;
    var verbose  = args.global.verbose ? true : false;
    // TODO: Pass verbose to display instead?
    var platform = new node.Platform(dry, verbose);
    // the options
    var env      = args.global.environ;
    var path     = args.global.file;
    var base     = platform.cwd();
    var params   = args.global.param || {};
    var force    = {};
    [ 'code', 'host', 'user' ].forEach(name => force[name] = args.global[name]);
    if ( args.global.password ) {
        force.password = read.question('Password: ', { hideEchoBack: true });
    }
    // the project & command
    var project = platform.project(env, path, base, params, force);
    var command = new (cmd.clazz())(args.global, args.local, platform, display, project);
    // prepare the command
    if ( args.cmd !== 'show' ) {
        platform.log('--- ' + chalk.bold('Prepare') + ' ---');
    }
    var actions = command.prepare();
    // execute the actions
    if ( args.cmd !== 'show' ) {
        platform.log('\n--- ' + chalk.bold('Progress') + ' ---'
               + (platform.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    }
    actions.execute();
    // display summary and/or error
    if ( args.cmd !== 'show' ) {
        platform.log('\n--- ' + chalk.bold('Summary') + ' ---'
               + (platform.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
        if ( actions.done.length ) {
            platform.log(chalk.green('Done') + ':');
            actions.done.forEach(a => a.display(platform, 'done'));
        }
    }
    if ( actions.error ) {
        platform.log(chalk.red('Error') + ':');
        actions.error.action.display(platform, 'error');
        platform.log(actions.error.message);
        if ( platform.verbose && actions.error.error && actions.error.error.stack ) {
            platform.log(actions.error.error.stack);
        }
    }
    if ( args.cmd !== 'show' ) {
        if ( actions.todo.length ) {
            platform.log(chalk.yellow('Not done') + ':');
            actions.todo.forEach(a => a.display(platform, 'todo'));
        }
        if ( ! actions.done.length && ! actions.error && ! actions.todo.length ) {
            platform.log('Nothing to do.');
        }
    }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself
 */

function main(argv, display)
{
    let prg  = program.makeProgram();
    let args = prg.parse(argv);
    try {
        if ( ! args.cmd || args.cmd === 'help' ) {
            execHelp(args, prg);
        }
        else if ( args.cmd === 'new' ) {
            execNew(
                args,
                prg.commands[args.cmd],
                display);
        }
        else {
            execWithProject(
                args,
                prg.commands[args.cmd],
                display);
        }
    }
    catch (err) {
        display.error(err, args.global.verbose);
    }
}

var display = new node.Display();
try {
    main(process.argv.slice(2), display);
}
catch (err) {
    // here, I think we should always be verbose... (unexpected error)
    display.error(err, true);
}
