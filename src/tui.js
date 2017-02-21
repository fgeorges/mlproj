#!/usr/bin/env node

"use strict";

const fs      = require('fs');
const path    = require('path');
const program = require('commander');
const request = require('request');
const cmd     = require('./commands');
const s       = require('./space');

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The platform implementation for Node.
 */

class Node extends s.Platform
{
    constructor(dry) {
	super();
	this.dry = dry;
    }

    log(msg) {
	console.log(msg);
    }

    warn(msg) {
	console.warn(msg);
    }

    resolve(href, base) {
	return path.resolve(base, href);
    }

    read(path) {
	var content = fs.readFileSync(path, 'utf8');
	return JSON.parse(content);
    }

    green(s) {
	return '\u001b[32m' + s + '\u001b[39m'
    }

    yellow(s) {
	return '\u001b[33m' + s + '\u001b[39m'
    }

    red(s) {
	return '\u001b[35m' + s + '\u001b[39m'
    }

    bold(s) {
        return '\u001b[1m' + s + '\u001b[22m'
    }

    get(url, user, pwd, error, success) {
	if ( this.dry ) {
	    success();
	    return;
	}
        request.get(
	    {
                url:  url,
                auth: {
		    user: user,
		    pass: pwd,
		    sendImmediately: false
                }
	    },
	    (err, http, body) => {
                if ( err ) {
		    error('Error performing a GET action: ' + err);
                }
                else if ( http.statusCode !== 200 ) {
		    error('Entity not retrieved: ' + body.errorResponse.message);
                }
                else {
		    success();
                }
	    });
    }

    post(url, data, user, pwd, error, success) {
	if ( this.dry ) {
	    success();
	    return;
	}
        request.post(
	    {
                url:  url,
                json: data,
                auth: {
		    user: user,
		    pass: pwd,
		    sendImmediately: false
                }
	    },
	    (err, http, body) => {
                if ( err ) {
		    error('Error performing a POST action: ' + err);
                }
                else if ( http.statusCode !== 201 ) {
		    error('Entity not created: ' + body.errorResponse.message);
                }
                else {
		    success();
                }
	    });
    }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself, using `commander`
 */

var resolved = false;
var commands = [{
    clazz       : cmd.DebugCommand,
    command     : 'debug <path>',
    description : 'log the given environment'
}, {
    clazz       : cmd.SetupCommand,
    command     : 'setup <path>',
    description : 'setup the given environment',
    options     : [
	// { option: '-d, --dry', label: 'dry run (do not execute, just display)' }
    ]
}];

program
    .version('0.1.0')
    .option('-v, --verbose', 'verbose mode')
    .option('-d, --dry',     'dry run');

commands.forEach(cmd => {
    var prg = program
        .command(cmd.command)
        .description(cmd.description);
    if ( cmd.options ) {
	cmd.options.forEach(opt => {
            prg = prg.option(opt.option, opt.label) });
    }
    prg.action(function(path) {
        resolved = true;
	var platform = new Node(program.dry ? true : false);
	var command  = new cmd.clazz(platform);
	if ( program.verbose ) {
	    command.verbose(true);
	}
        try {
	    var base = process.cwd();
            command.prepare(path, base);
	    if ( command.verbose() ) {
		command.space.messages.forEach(msg => {
		    console.log(platform.yellow('Info') + ': ' + msg);
		});
	    }
            command.execute();
        }
        catch ( err ) {
            console.warn(platform.red('Error') + ': ' + err.message);
        }
    });
});

program.parse(process.argv);

if ( ! resolved ) {
    program.help();
}
