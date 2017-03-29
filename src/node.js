"use strict";

(function() {

    const fs      = require('fs');
    const os      = require('os');
    const path    = require('path');
    const chalk   = require('chalk');
    const read    = require('readline-sync');
    const request = require('request');
    const xml     = require('xml2js');
    const s       = require('./space');

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The platform implementation for Node.
     */

    class Node extends s.Platform
    {
	constructor(dry, verbose) {
	    super(dry, verbose);
	    // try one...
	    var proj = Node.userJson(this, '.mlproj.json');
	    if ( proj ) {
		this._config = proj.config;
	    }
	    else {
		// ...or the other
		proj = Node.userJson(this, 'mlproj.json');
		if ( proj ) {
		    this._config = proj.config;
		}
	    }
	}

	config(name) {
	    if ( this._config ) {
		return this._config[name];
	    }
	}

	configs() {
	    return this._config ? Object.keys(this._config) : [];
	}

	cwd() {
	    return process.cwd();
	}

	mkdir(path) {
	    // For now, this function throws an error if the directory already
	    // exists.  If this has to be changed, just catch errors with the
	    // code `EEXISTS`:
	    //
	    // try { fs.mkdirSync(path); }
	    // catch ( err ) {
	    //     if ( err.code === 'EEXIST' ) { /* ignore */ }
	    //     else { throw err; }
	    // }
	    fs.mkdirSync(path);
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

	read(path) {
	    return fs.readFileSync(path, 'utf8');
	}

	json(path, validate) {
	    var json = JSON.parse(this.read(path));
	    if ( validate ) {
		return this.validateJson(json);
	    }
	    return json;
	}

	xml(path, callback) {
	    var parser  = new xml.Parser();
	    var content = this.read(path);
	    parser.parseString(content, (err, result) => {
		if ( err ) {
		    throw new Error('Error parsing XML: ' + err + ', at ' + path);
		}
		callback(result);
	    });
	}

	write(path, content) {
	    fs.writeFileSync(path, content, 'utf8');
	}

	green(s) {
	    return chalk.green(s);
	}

	yellow(s) {
	    return chalk.yellow(s);
	}

	red(s) {
	    return chalk.red(s);
	}

	bold(s) {
	    return chalk.bold(s);
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
		// ask for password interactively first time it is used
		pwd = read.question('Password: ', { hideEchoBack: true });
		this.space.param('@password', pwd);
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
		// XDBC PUT /insert returns 200
		else if ( http.statusCode !== 200 && http.statusCode !== 201 && http.statusCode !== 204 ) {
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

    Node.userJson = (pf, name) => {
    	try {
	    var path = pf.resolve(name, os.homedir());
	    return pf.json(path, true);
	}
	catch (err) {
	    // ignore ENOENT, file does not exist
	    if ( err.code !== 'ENOENT' ) {
		throw err;
	    }
	}
    }

    module.exports = {
        Node : Node
    }
}
)();
