#!/usr/bin/env node

"use strict";

const fs      = require('fs');
const program = require('commander');
const read    = require('readline-sync');
const cmd     = require('./commands');
const node    = require('./node');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The command action implementations.
 */

// implementation of the action for command `new`
function execHelp(program, cmd)
{
    console.log('');
    console.log('Command still to be implemented!');
    console.log('');
    console.log('Try and factorize (some of) it with `new`, as not relying on a project...');
    console.log('');
    console.dir(cmd);
    console.log('');
}

// implementation of the action for command `new`
function execNew(program, cmd)
{
    // check forbidden options
    [ 'dry', 'environ', 'file', 'code', 'host', 'srcdir', 'user', 'password' ].forEach(name => {
	if ( program[name] ) {
	    throw new Error('Option `--' + name + '` not supported for command `' + cmd.command + '`');
	}
    });

    // the platform
    var verbose  = program.verbose ? true : false;
    var platform = new node.Node(false, verbose);
    var dir      = platform.cwd();

    // Check the directory is empty...!
    if ( fs.readdirSync(dir).length ) {
	throw new Error('Directory is not empty: ' + dir);
    }

    // gather info by asking the user...
    platform.log('--- ' + platform.bold('Questions') + ' ---');
    var abbrev   = read.question('Project code    : ');
    var title    = read.question('Title           : ');
    var dfltName = 'http://mlproj.org/example/' + abbrev;
    var name     = read.question('Name URI (' + dfltName + '): ', { defaultInput: dfltName });
    var version  = read.question('Version  (0.1.0): ', { defaultInput: '0.1.0' });
    var port     = read.question('Port     (8080) : ', { defaultInput: '8080' });

    // execute the command
    var command  = new cmd.clazz(platform, dir, abbrev, title, name, version, port);
    var xpdir    = command.execute();

    // summary
    platform.log('\n--- ' + platform.bold('Summary') + ' ---');
    platform.log(platform.green('✓') + ' Project created: \t' + abbrev);
    platform.log(platform.green('→') + ' Check/edit files in: \t' + xpdir);
}

// implementation of the action for any command accepting a project/environment
function execWithProject(program, cmd)
{
    // the platform
    var dry      = program.dry     ? true : false;
    var verbose  = program.verbose ? true : false;
    var platform = new node.Node(dry, verbose);
    // the options
    var env      = program.environ;
    var path     = program.file;
    var params   = program.param;
    var force    = {};
    [ 'code', 'host', 'srcdir', 'user' ].forEach(name => force[name] = program[name]);
    if ( program.password ) {
	force.password = read.question('Password: ', { hideEchoBack: true });
    }
    // the project
    platform.project(env, path, params, force, project => {
	// execute the command
	project.execute(cmd.clazz);
    });
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself, using `commander`
 */

// the commands
var commands = [{
    clazz       : cmd.HelpCommand,
    command     : 'help',
    description : 'use `help <command>` for help on sub-commands',
    impl        : execHelp
}, {
    clazz       : cmd.NewCommand,
    command     : 'new',
    description : 'create a new project in an empty dir',
    impl        : execNew
}, {
    clazz       : cmd.ShowCommand,
    command     : 'show',
    description : 'display the environment',
    impl        : execWithProject
}, {
    clazz       : cmd.SetupCommand,
    command     : 'setup',
    description : 'setup the environment on MarkLogic',
    options     : [
	// { option: '-d, --dry', label: 'dry run (do not execute, just display)' }
    ],
    impl        : execWithProject
}, {
    clazz       : cmd.DeployCommand,
    command     : 'deploy',
    description : 'deploy modules to the modules database',
    impl        : execWithProject
}];

// collect params from several `--param name:value` options
var params = (item, memo) => {
    var idx = item.indexOf(':');
    if ( idx < 0 ) {
	idx = item.indexOf('=');
    }
    if ( idx < 0 ) {
	throw new Error('Invalid parameter, must use : or = between name and value');
    }
    var name  = item.slice(0, idx);
    var value = item.slice(idx + 1);
    memo[name] = value;
    return memo;
};

// the global options
program
    .version('0.14.0')
    .option('-c, --code <code>',        'set/override the @code')
    .option('-d, --dry',                'dry run')
    .option('-e, --environ <name>',     'environment name')
    .option('-f, --file <file>',        'environment file')
    .option('-h, --host <host>',        'set/override the @host')
    .option('-p, --param <name:value>', 'set/override a parameter value (use : or =)', params, {})
    .option('-s, --srcdir <dir>',       'set/override the @srcdir')
    .option('-u, --user <user>',        'set/override the @user')
    .option('-v, --verbose',            'verbose mode')
    .option('-z, --password',           'ask for password interactively');

// marker to validate a command has been resolved
var resolved = false;

// setup the commands
commands.forEach(cmd => {
    var prg = program
        .command(cmd.command)
        .description(cmd.description);
    if ( cmd.options ) {
	cmd.options.forEach(opt => {
            prg = prg.option(opt.option, opt.label) });
    }
    prg.action(() => {
        resolved = true;
	cmd.impl(program, cmd);
    });
});

// parse the command line and execute the command
program.parse(process.argv);

// has any command been resolved?
if ( ! resolved ) {
    // TODO: Add an error message ("no command or not correct, usage: ...")
    program.help();
}
