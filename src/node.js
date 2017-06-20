"use strict";

(function() {

    const fs      = require('fs');
    const os      = require('os');
    const path    = require('path');
    const chalk   = require('chalk');
    const read    = require('readline-sync');
    const request = require('sync-request');
    const xml     = require('xml2js');
    const core    = require('mlproj-core');

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The platform implementation for Node.
     */

    class Node extends core.Platform
    {
        constructor(dry, verbose) {
            super(dry, verbose);
            // try one...
            var proj = Node.userJson(this, '.mlproj.json');
            if ( proj ) {
                this._config  = proj.config;
                this._connect = proj.connect;
            }
            else {
                // ...or the other
                proj = Node.userJson(this, 'mlproj.json');
                if ( proj ) {
                    this._config  = proj.config;
                    this._connect = proj.connect;
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

        projectXml(path, callback) {
            var parser  = new xml.Parser();
            var content = this.read(path);
            var p;
            parser.parseString(content, (err, result) => {
                if ( err ) {
                    throw new Error('Error parsing XML: ' + err + ', at ' + path);
                }
                if ( ! result || ! result.project ) {
                    throw new Error('Bad project.xml, no document or no project element: ' + path);
                }
                if ( ! result.project['$'] || ! result.project['$'].abbrev ) {
                    throw new Error('Bad project.xml, no abbrev: ' + path);
                }
                p = result.project;
            });
            if ( ! p ) {
                // the following makes it clear it is not async, just using a
                // callback, synchronously:
                // https://github.com/Leonidas-from-XIV/node-xml2js/issues/159#issuecomment-248599477
                throw new Error('Internal error.  Has xml2js become async?  Please report this.');
            }
            let project = {};
            if ( p['$'].abbrev  ) project.abbrev  = p['$'].abbrev;
            if ( p['$'].name    ) project.name    = p['$'].name;
            if ( p['$'].version ) project.version = p['$'].version;
            if ( p.title        ) project.title   = p.title[0];
            return project;
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

        url(api, url) {
            if ( ! this.space ) {
                throw new Error('No space set on the platform for host');
            }
            var host = this.space.param('@host');
            if ( ! host ) {
                throw new Error('No host in space');
            }
            var decl   = this.space.api(api);
            var scheme = decl.ssl ? 'https' : 'http';
            var root   = decl.root.length ? '/' + decl.root : decl.root;
            return scheme + '://' + host + ':' + decl.port + root + url;
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

        get(api, url) {
            var url   = this.url(api, url);
            var creds = this.credentials();
            // TODO: Do we want request-sync, or actually deal directly with a sub-process...?
            var resp  = request('GET', url, {
                headers: {
                    Accept: 'application/json'
                },
                auth:    {
                    user: creds[0],
                    pass: creds[1],
                    sendImmediately: false
                }
            });
            if ( resp.statusCode === 200 ) {
                return JSON.parse(resp.getBody());
            }
            else if ( resp.statusCode === 404 ) {
                return;
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                // What about resp.body.errorresponse.message?
                throw new Error('Error retrieving entity: ' + resp.body);
            }
        }

        post(api, url, data) {
            var url     = this.url(api, url);
            var creds   = this.credentials();
            var options = {
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
            var resp  = request('POST', url, options);
            if ( resp.statusCode === (data ? 201 : 200) ) {
                return;
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                // What about resp.body.errorresponse.message?
                throw new Error('Entity not created: ' + resp.body);
            }
        }

        put(api, url, data, type) {
            var url     = this.url(api, url);
            var creds   = this.credentials();
            var options = {
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
            var resp  = request('PUT', url, options);
            // XDBC PUT /insert returns 200
            if ( resp.statusCode === 200 || resp.statusCode === 201 || resp.statusCode === 204 ) {
                return;
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                // What about resp.body.errorresponse.message?
                throw new Error('Entity not updated: ' + resp.body);
            }
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
