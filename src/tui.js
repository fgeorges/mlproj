#!/usr/bin/env node

"use strict";

const program  = require('commander');
const cmd      = require('./commands');
const node     = require('./node');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself, using `commander`
 */

var resolved = false;
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
    .version('0.10.0')
    .option('-d, --dry',            'dry run')
    .option('-e, --environ <name>', 'environment name')
    .option('-f, --file <file>',    'environment file')
    .option('-v, --verbose',        'verbose mode');

commands.forEach(cmd => {
    var prg = program
        .command(cmd.command)
        .description(cmd.description);
    if ( cmd.options ) {
	cmd.options.forEach(opt => {
            prg = prg.option(opt.option, opt.label) });
    }
    prg.action(function() {
        resolved = true;
	var dry      = program.dry     ? true : false;
	var verbose  = program.verbose ? true : false;
	var platform = new node.Node(dry, verbose);
	var command  = new cmd.clazz(platform);
	if ( program.verbose ) {
	    command.verbose(true);
	}
	var env  = program.environ;
	var path = program.file;
	var base = process.cwd();
        command.prepare(env, path, base, () => {
	    command.execute(() => {
		command.summary();
	    });
	});
    });
});

program.parse(process.argv);

if ( ! resolved ) {
    program.help();
}
