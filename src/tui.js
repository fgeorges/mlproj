#!/usr/bin/env node

"use strict";

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
function plainCmdStart(args, extra)
{
    // check forbidden options
    let options = [ 'environ', 'file', 'code', 'host', 'user', 'password' ];
    if ( extra ) {
        options = options.concat(extra);
    }
    options.forEach(name => {
        if ( args.global[name] ) {
            throw new Error('Option `--' + name + '` not supported');
        }
    });
}

// implementation of the action for command `help`
function execHelp(ctxt, args, prg)
{
    // validate options
    plainCmdStart(args, 'dry');

    // lexical sugar
    const pf    = ctxt.platform;
    const chalk = ctxt.display.chalk;

    // the command
    let name = args.local.cmd;
    if ( ! name ) {

        pf.log(`
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
function execNew(ctxt, args, cmd)
{
    // validate options
    plainCmdStart(args, 'dry');

    // lexical sugar
    const pf    = ctxt.platform;
    const dir   = ctxt.platform.cwd;
    const chalk = ctxt.display.chalk;

    // check the directory is empty...
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
    pf.log('--- ' + chalk.bold('Questions') + ' ---');
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
    pf.log('\n--- ' + chalk.bold('Progress') + ' ---'
           + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    actions.execute();
    pf.log('\n--- ' + chalk.bold('Summary') + ' ---'
           + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    if ( actions.done.length ) {
        pf.log(chalk.green('Done') + ':');
        pf.log(chalk.green('✓') + ' Project created: \t' + loc.abbrev);
        pf.log(chalk.green('→') + ' Check/edit files in:\t' + actions.done[0].xpdir);
    }
    if ( actions.error ) {
        pf.log(chalk.red('Error') + ':');
        pf.log(chalk.red('✗') + ' Project creation: \t' + loc.abbrev);
        pf.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            pf.log(actions.error.error.stack);
        }
    }
    if ( actions.todo.length ) {
        pf.log(chalk.yellow('Not done') + ':');
        pf.log(chalk.yellow('✗') + ' Project creation: \t' + loc.abbrev);
        pf.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            pf.log(actions.error.error.stack);
        }
    }
    // TODO: Really. do it here?  Would be better in main()...
    // Besides, this whole thing is copied three times...
    if ( actions.error ) {
        process.exit(1);
    }
}

function makeEnviron(ctxt, env, path, params, force, cmd)
{
    const initTrace = thing => {
        // resolve trace options with defaults
        if ( ctxt.tracedir ) {
            ctxt.trace = true;
        }
        else {
            const t = thing.config('trace');
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
    };
    // ask to retrieve cluster topology, except in case of init (apis not available yet)
    if ( cmd !== 'init' ) {
        ctxt.fetchTopology = true;
    }
    // invalid and default values
    if ( env && path ) {
        throw new Error('Both `environ` and `path` set: ' + env + ', ' + path);
    }
    if ( ! env && ! path ) {
        env = 'default';
    }
    // do it (either env or file or fake)
    let res;
    if ( env ) {
        const proj = new core.Project(ctxt, ctxt.platform.cwd);
        // init trace before compiling
        initTrace(proj);
        res = proj.environ(env, params, force);
        // TODO: Review trace here after having the whole environ available?
    }
    else if ( path ) {
        const json = ctxt.platform.json(path);
        res = new core.Environ(ctxt, json, path);
        // init trace before compiling
        initTrace(res);
        res.compile(params, force);
    }
    else {
        res = new core.FakeEnviron(ctxt, params, force);
        // init trace
        initTrace(res);
    }
    return res;
}

// implementation of the action for any command accepting a project/environment
function execWithProject(ctxt, args, cmd)
{
    // lexical sugar
    const pf     = ctxt.platform;
    const chalk  = ctxt.display.chalk;
    // the options
    const env    = args.global.environ;
    const path   = args.global.file;
    const params = args.global.param || {};
    const force  = {};
    [ 'code', 'host', 'user' ].forEach(name => force[name] = args.global[name]);
    if ( args.global.ipassword ) {
        force.password = read.question('Password: ', { hideEchoBack: true });
    }
    else if ( args.global.password ) {
        force.password = args.global.password;
    }
    // the project & command
    var environ = makeEnviron(ctxt, env, path, params, force, args.cmd);
    var command = new (cmd.clazz())(args.cmd, args.global, args.local, ctxt, environ);
    // prepare the command
    if ( args.cmd !== 'show' ) {
        pf.log('--- ' + chalk.bold('Prepare') + ' ---');
    }
    var actions = command.prepare();
    // execute the actions
    if ( args.cmd !== 'show' ) {
        pf.log('\n--- ' + chalk.bold('Progress') + ' ---'
               + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
    }
    actions.execute();
    // display summary and/or error
    if ( args.cmd !== 'show' ) {
        pf.log('\n--- ' + chalk.bold('Summary') + ' ---'
               + (ctxt.dry ? ' (' + chalk.red('dry run, not for real') + ')' : ''));
        if ( actions.done.length ) {
            pf.log(chalk.green('Done') + ':');
            actions.done.forEach(a => a.display(pf, 'done'));
        }
    }
    if ( actions.error ) {
        pf.log(chalk.red('Error') + ':');
        actions.error.action.display(pf, 'error');
        pf.log(actions.error.message);
        if ( ctxt.verbose && actions.error.error && actions.error.error.stack ) {
            pf.log(actions.error.error.stack);
        }
    }
    if ( args.cmd !== 'show' ) {
        if ( actions.todo.length ) {
            pf.log(chalk.yellow('Not done') + ':');
            actions.todo.forEach(a => a.display(pf, 'todo'));
        }
        if ( ! actions.done.length && ! actions.error && ! actions.todo.length ) {
            pf.log('Nothing to do.');
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
        else {
            let cmd = prg.commands[args.cmd];
            if ( args.cmd === 'new' ) {
                execNew(ctxt, args, cmd);
            }
            else {
                execWithProject(ctxt, args, cmd);
            }
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
