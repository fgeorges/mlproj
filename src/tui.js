#!/usr/bin/env node

"use strict";

const fs      = require('fs');
const program = require('commander');
const read    = require('readline-sync');
const cmd     = require('./commands');
const node    = require('./node');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself, using `commander`
 */

var resolved = false;
// command `new` is handled differently
var commands = [{
    clazz       : cmd.ShowCommand,
    command     : 'show',
    description : 'display the environment'
}, {
    clazz       : cmd.SetupCommand,
    command     : 'setup',
    description : 'setup the environment on MarkLogic',
    options     : [
	// { option: '-d, --dry', label: 'dry run (do not execute, just display)' }
    ]
}, {
    clazz       : cmd.DeployCommand,
    command     : 'deploy',
    description : 'deploy modules to the modules database'
}];

program
    .version('0.12.0')
    .option('-c, --code <code>',    'set/override the @code')
    .option('-d, --dry',            'dry run')
    .option('-e, --environ <name>', 'environment name')
    .option('-f, --file <file>',    'environment file')
    .option('-h, --host <host>',    'set/override the @host')
    .option('-s, --srcdir <dir>',   'set/override the @srcdir')
    .option('-u, --user <user>',    'set/override the @user')
    .option('-v, --verbose',        'verbose mode')
    .option('-z, --password',       'ask for password interactively');

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
	// the platform
	var dry      = program.dry     ? true : false;
	var verbose  = program.verbose ? true : false;
	var platform = new node.Node(dry, verbose);
	// the project
	var env      = program.environ;
	var path     = program.file;
	var force    = {};
	[ 'code', 'host', 'srcdir', 'user' ].forEach(name => force[name] = program[name]);
	if ( program.password ) {
	    force.password = read.question('Password: ', { hideEchoBack: true });
	}
	platform.project(env, path, force, project => {
	    // execute the command
	    project.execute(cmd.clazz);
	});
    });
});

// Command `new` is handled differently, as it does not rely on an environment.
// Also, all the info gathering is dependent on the platform, web-based would
// provide them straight to the command as the content of a form, so it is done
// here also.
program
    .command('new')
    .description('create a new project in an empty dir')
    .action(() => {
        resolved = true;
	if ( program.dry ) {
	    throw new Error('Dry run option not supported for `new`');
	}
	if ( program.environ ) {
	    throw new Error('Environment name option not supported for `new`');
	}
	if ( program.file ) {
	    throw new Error('Environment file option not supported for `new`');
	}
	if ( program.code ) {
	    throw new Error('Code option not supported for `new`');
	}
	if ( program.host ) {
	    throw new Error('Host option not supported for `new`');
	}
	if ( program.srcdir ) {
	    throw new Error('Source dir option not supported for `new`');
	}
	if ( program.user ) {
	    throw new Error('User option not supported for `new`');
	}
	if ( program.password ) {
	    throw new Error('Password option not supported for `new`');
	}
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
	var command  = new cmd.NewCommand(platform, dir, abbrev, title, name, version, port);
	var xpdir    = command.execute();

	// summary
	platform.log('\n--- ' + platform.bold('Summary') + ' ---');
	platform.log(platform.green('✓') + ' Project created: \t' + abbrev);
	platform.log(platform.green('→') + ' Check/edit files in: \t' + xpdir);
    });

program.parse(process.argv);

if ( ! resolved ) {
    program.help();
}
