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
    constructor(dry, verbose) {
	super();
	this.dry     = dry;
	this.verbose = verbose;
    }

    debug(msg) {
	console.log('DEBUG: ' + msg);
    }

    log(msg) {
	console.log(msg);
    }

    info(msg) {
	if ( this.verbose ) {
	    console.log(this.yellow('Info') + ': ' + msg);
	}
    }

    warn(msg) {
	console.warn(msg);
    }

    line(indent, name, value) {
	var s = '';
	while ( indent-- ) {
	    s += '   ';
	}
	s += name;
	if ( value !== undefined ) {
	    const PAD = '                        '; // 24 spaces
	    s += ': ';
	    s += PAD.slice(s.length);
	    s += value;
	}
	console.log(s);
    }

    resolve(href, base) {
	return path.resolve(base, href);
    }

    text(path) {
	return fs.readFileSync(path, 'utf8');
    }

    read(path) {
	return JSON.parse(this.text(path));
    }

    green(s) {
	return '\u001b[32m' + s + '\u001b[39m'
    }

    yellow(s) {
	return '\u001b[33m' + s + '\u001b[39m'
    }

    red(s) {
	return '\u001b[31m' + s + '\u001b[39m'
    }

    bold(s) {
        return '\u001b[1m' + s + '\u001b[22m'
    }

    url(endpoint) {
	if ( ! this.space ) {
	    throw new Error('No space set on the platform for host');
	}
        var host = this.space.param('@host');
	if ( ! host ) {
	    throw new Error('No host in space');
	}
	return 'http://' + host + ':' + endpoint.port + '/' + endpoint.api + endpoint.url;
    }

    credentials() {
	if ( ! this.space ) {
	    throw new Error('No space set on the platform for credentials');
	}
        var user = this.space.param('@user');
        var pwd  = this.space.param('@password');
	if ( ! user ) {
	    throw new Error('No user in space');
	}
	if ( ! pwd ) {
	    throw new Error('No password in space');
	}
	return [ user, pwd ];
    }

    verboseHttp(http, body) {
	if ( this.verbose ) {
            this.warn('[' + this.bold('verbose') + '] Return status: ' + http.statusCode);
            this.warn('[' + this.bold('verbose') + '] Body:');
	    this.log(body);
	}
    }

    get(endpoint, error, success) {
	var url   = this.url(endpoint);
	var creds = this.credentials();
        request.get(
	    {
                url:     url,
		headers: {
		    Accept: 'application/json'
		},
                auth:    {
		    user: creds[0],
		    pass: creds[1],
		    sendImmediately: false
                }
	    },
	    (err, http, body) => {
                if ( err ) {
		    error(err);
                }
                else if ( http.statusCode === 200 ) {
		    success(JSON.parse(body));
                }
                else if ( http.statusCode === 404 ) {
		    success();
                }
                else {
		    this.verboseHttp(http, body);
		    error('Error retrieving entity: ' + body.errorResponse.message);
                }
	    });
    }

    post(endpoint, data, error, success) {
	var url   = this.url(endpoint);
	var creds = this.credentials();
	var options = {
            url:  url,
            auth: {
		user: creds[0],
		pass: creds[1],
		sendImmediately: false
            }
	};
	if ( data ) {
            options.json = data;
	}
	else {
	    options.headers = {
		"Content-Type": 'application/x-www-form-urlencoded'
	    };
	}
        request.post(options, (err, http, body) => {
            if ( err ) {
		error(err);
            }
            else if ( http.statusCode !== (data ? 201 : 200) ) {
		this.verboseHttp(http, body);
		error('Entity not created: ' + body.errorResponse.message);
            }
            else {
		success();
            }
	});
    }

    put(endpoint, data, error, success, type) {
	var url   = this.url(endpoint);
	var creds = this.credentials();
	var options = {
            url:  url,
            auth: {
		user: creds[0],
		pass: creds[1],
		sendImmediately: false
            }
	};
	if ( data ) {
	    if ( type ) {
		options.headers = { "Content-Type": type };
		options.body    = data;
	    }
	    else {
		options.json = data;
	    }
	}
	else {
	    options.headers = {
		"Content-Type": 'application/x-www-form-urlencoded'
	    };
	}
        request.put(options, (err, http, body) => {
            if ( err ) {
		error(err);
            }
            else if ( http.statusCode !== 201 && http.statusCode !== 204 ) {
		this.verboseHttp(http, body);
		error('Entity not updated: ' + ( body.errorResponse
						 ? body.errorResponse.message
						 : body ));
            }
            else {
		success();
            }
	});
    }

    allFiles(dir, filter, ignored)
    {
	// extract the basename of the dir path in `p`
	const basename = p => {
	    var idx = p.lastIndexOf('/');
	    // no slash
	    if ( idx < 0 ) {
		return p;
	    }
	    // slash at the end
	    else if ( idx + 1 === p.length ) {
		var pen = p.lastIndexOf('/', idx - 1);
		// no other slash
		if ( pen < 0 ) {
		    return p.slice(0, idx);
		}
		// take name between both slashes
		else {
		    return p.slice(pen + 1, idx);
		}
	    }
	    // slash somewhere else
	    else {
		return p.slice(idx + 1);
	    }
	};

	// recursive implementation
	const impl = (dir, list) => {
	    fs.readdirSync(dir).forEach(file => {
		const p = path.join(dir, file);
		const s = fs.statSync(p);
		// TODO: Do something with `s.isSymbolicLink()`?
		if ( ! (s.isBlockDevice() || s.isCharacterDevice() || s.isFIFO() || s.isSocket()) ) {
		    const f = { name: file, path: p };
		    if ( s.isDirectory() ) {
			f.files = [];
		    }
		    if ( ! filter || filter(f, dir) ) {
			list.push(f);
			if ( s.isDirectory() ) {
			    impl(p, f.files);
			}
		    }
		    else if ( ignored ) {
			ignored(f, dir);
		    }
		}
	    });
	};

	// only for a directory
	if ( ! fs.statSync(dir).isDirectory() ) {
	    throw new Error('Can only list files of a directory: ' + dir);
	}

	// set the top-level infos, and call recursive implementation
	var files = {
	    files: [],
	    path : dir,
	    name : basename(dir)
	};
	impl(dir, files.files);

	// flaten the list
	const flaten = (dir, list) => {
	    dir.files.forEach(f => {
		if ( f.files ) {
		    flaten(f, res);
		}
		else {
		    res.push(f.path);
		}
	    });
	};
	var res = [];
	flaten(files, res);

	return res;
    }
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The program itself, using `commander`
 */

var resolved = false;
var commands = [{
    clazz       : cmd.DebugCommand,
    command     : 'debug',
    description : 'log the given environment'
}, {
    clazz       : cmd.SetupCommand,
    command     : 'setup',
    description : 'setup the given environment',
    options     : [
	// { option: '-d, --dry', label: 'dry run (do not execute, just display)' }
    ]
}, {
    clazz       : cmd.DeployCommand,
    command     : 'deploy',
    description : 'deploy modules to the modules database'
}];

program
    .version('0.7.0')
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
	var platform = new Node(program.dry ? true : false, program.verbose ? true : false);
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
