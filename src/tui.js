#!/usr/bin/env node

"use strict";

const chalk   = require('chalk');
const fs      = require('fs');
const read    = require('readline-sync');
const core    = require('mlproj-core');
const node    = require('./node');
const program = require('./program');
const pkg     = require('../package.json');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The command action implementations.
 */

// start of plain commands, validate forbidden options
function plainCmdStart(args)
{
    // check forbidden options
    [ 'dry', 'environ', 'file', 'code', 'host', 'user', 'password' ].forEach(name => {
        if ( args.global[name] ) {
            throw new Error('Option `--' + name + '` not supported for command `' + args.cmd + '`');
        }
    });
}

// implementation of the action for command `new`
function execHelp(ctxt, args, prg)
{
    // validate options
    plainCmdStart(args);

    // the command
    let name = args.local.cmd;
    if ( ! name ) {

        ctxt.platform.log(`
   This is mlproj, version ` + pkg.version + ` (using core ` + ctxt.coreVersion() + `)

   Usage:

       mlproj [options] <command> [options]

   Commands:

       help         display help about another command
       new          create a new project in the current directory
       show         display the environment
       init         initialize a new MarkLogic instance or cluster
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
       -T, --trace                enable HTTP traces
       -t, --trace-dir <dir>      the dir to put HTTP traces (enable as well)
       -u, --user <user>          set/override the @user
       -v, --verbose              verbose mode
       -z, --ipassword            ask for password interactively
       -Z, --password <pwd>       set/override the @password

   Command options:

       See the help of individual commands, e.g. "mlproj help load".

   Visit http://mlproj.org/ for all details.
`);
    }
    else {
        var cmd = prg.commands[name];
        if ( ! cmd ) {
            ctxt.platform.log('Unknwon command: ' + name);
        }
        else {
            ctxt.platform.log('');
            ctxt.platform.log('   ' + cmd.desc());
            ctxt.platform.log('');
            ctxt.platform.log('   Usage:');
            ctxt.platform.log('');
            ctxt.platform.log('       mlproj ' + chalk.bold(name) + ' ' + cmd.usage());
            ctxt.platform.log('');
            ctxt.platform.log('   ' + cmd.help);
            ctxt.platform.log('');
            ctxt.platform.log('   Reference:');
            ctxt.platform.log('');
            ctxt.platform.log('       http://mlproj.org/commands#' + name);
            ctxt.platform.log('');
        }
    }
}

// implementation of the action for command `new`
function execNew(ctxt, args, cmd)
{
    // validate options
    plainCmdStart(args);
    var dir = ctxt.platform.cwd;

    // Check the directory is empty...!
    if ( ! args.local.force && fs.readdirSync(dir).length ) {
        const prompt = 'Directory is not empty, do you want to force creation and continue?';
        if ( read.keyInYNStrict(prompt) ) {
            args.local.force = true;
        }
        else {
            return;
        }
    }

    // gather info by asking the user...
    ctxt.platform.log('--- ' + chalk.bold('Questions') + ' ---');
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
    var command = new (cmd.clazz())(args.cmd, args.global, args.local, ctxt);
    var actions = command.prepare();
    ctxt.platform.log('\n--- ' + chalk.bold('Progress') + ' ---'
           + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    actions.execute();
    ctxt.platform.log('\n--- ' + chalk.bold('Summary') + ' ---'
           + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    if ( actions.done.length ) {
        ctxt.platform.log(chalk.green('Done') + ':');
        ctxt.platform.log(chalk.green('✓') + ' Project created: \t' + loc.abbrev);
        ctxt.platform.log(chalk.green('→') + ' Check/edit files in:\t' + actions.done[0].cmd.xpdir);
    }
    if ( actions.error ) {
        ctxt.platform.log(chalk.red('Error') + ':');
        ctxt.platform.log(chalk.red('✗') + ' Project creation: \t' + loc.abbrev);
        ctxt.platform.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            ctxt.platform.log(actions.error.error.stack);
        }
    }
    if ( actions.todo.length ) {
        ctxt.platform.log(chalk.yellow('Not done') + ':');
        ctxt.platform.log(chalk.yellow('✗') + ' Project creation: \t' + loc.abbrev);
        ctxt.platform.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            ctxt.platform.log(actions.error.error.stack);
        }
    }
    // TODO: Really. do it here?  Would be better in main()...
    // Besides, this whole thing is copied three times...
    if ( actions.error ) {
        process.exit(1);
    }
}

function makeEnviron(ctxt, env, path, params, force)
{
    // invalid and default values
    if ( env && path ) {
        throw new Error('Both `environ` and `path` set: ' + env + ', ' + path);
    }
    if ( ! env && ! path ) {
        env = 'default';
    }
    // do it (either env or file)
    let res;
    if ( env ) {
        let proj = new core.Project(ctxt, ctxt.platform.cwd);
        res = proj.environ(env, params, force);
    }
    else {
        let json = ctxt.platform.json(path);
        res = new core.Environ(ctxt, json);
        res.compile(params, force);
    }
    // resolve trace options with defaults
    if ( ctxt.tracedir ) {
        ctxt.trace = true;
    }
    else {
        const t = res.config('trace');
        if ( ctxt.trace ) {
            if ( ! t || ! t.dir ) {
                throw new Error('HTTP trace enabled by option, but no dir given');
            }
            ctxt.tracedir = t.dir;
        }
        else if ( t ) {
            if ( t.dir ) {
                if ( t.enabled || t.enabled === undefined ) {
                    ctxt.trace    = true;
                    ctxt.tracedir = t.dir;
                }
            }
            else if ( t.enabled ) {
                throw new Error('HTTP trace enabled in config, but no dir given');
            }
        }
        else {
            // no trace option nor config: nothing to do
        }
    }
    return res;
}

// implementation of the action for any command accepting a project/environment
function execWithProject(ctxt, args, cmd)
{
    // the options
    var env      = args.global.environ;
    var path     = args.global.file;
    var params   = args.global.param || {};
    var force    = {};
    [ 'code', 'host', 'user' ].forEach(name => force[name] = args.global[name]);
    if ( args.global.ipassword ) {
        force.password = read.question('Password: ', { hideEchoBack: true });
    }
    else if ( args.global.password ) {
        force.password = args.global.password;
    }
    // the project & command
    var environ = makeEnviron(ctxt, env, path, params, force);
    var command = new (cmd.clazz())(args.cmd, args.global, args.local, ctxt, environ);
    // prepare the command
    if ( args.cmd !== 'show' ) {
        ctxt.platform.log('--- ' + chalk.bold('Prepare') + ' ---');
    }
    var actions = command.prepare();
    // execute the actions
    if ( args.cmd !== 'show' ) {
        ctxt.platform.log('\n--- ' + chalk.bold('Progress') + ' ---'
               + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    }
    actions.execute();
    // display summary and/or error
    if ( args.cmd !== 'show' ) {
        ctxt.platform.log('\n--- ' + chalk.bold('Summary') + ' ---'
               + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
        if ( actions.done.length ) {
            ctxt.platform.log(chalk.green('Done') + ':');
            actions.done.forEach(a => a.display(ctxt.platform, 'done'));
        }
    }
    if ( actions.error ) {
        ctxt.platform.log(chalk.red('Error') + ':');
        actions.error.action.display(ctxt.platform, 'error');
        ctxt.platform.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            ctxt.platform.log(actions.error.error.stack);
        }
    }
    if ( args.cmd !== 'show' ) {
        if ( actions.todo.length ) {
            ctxt.platform.log(chalk.yellow('Not done') + ':');
            actions.todo.forEach(a => a.display(ctxt.platform, 'todo'));
        }
        if ( ! actions.done.length && ! actions.error && ! actions.todo.length ) {
            ctxt.platform.log('Nothing to do.');
        }
    }
    // TODO: Really. do it here?  Would be better in main()...
    // Besides, this whole thing is copied three times...
    if ( actions.error ) {
        process.exit(1);
    }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself
 */

function main(argv)
{
    const prg      = program.makeProgram();
    const args     = prg.parse(argv);
    const dry      = args.global.dry     ? true : false;
    const verbose  = args.global.verbose ? true : false;
    const trace    = args.global.trace;
    const tracedir = args.global.tracedir;
    const ctxt     = new node.Context(dry, verbose, trace, tracedir);
    ctxt.platform.log('');
    try {
        if ( ! args.cmd || args.cmd === 'help' ) {
            execHelp(ctxt, args, prg);
        }
        else if ( args.cmd === 'new' ) {
            execNew(
                ctxt,
                args,
                prg.commands[args.cmd]);
        }
        else {
            execWithProject(
                ctxt,
                args,
                prg.commands[args.cmd]);
        }
    }
    catch (err) {
        ctxt.display.error(err);
        process.exit(1);
    }
}

try {
    main(process.argv.slice(2));
}
catch (err) {
    node.Display.error(err, true);
    process.exit(1);
}
