"use strict";

(function() {

    const fs      = require('fs');
    const os      = require('os');
    const path    = require('path');
    const chalk   = require('chalk');
    const read    = require('readline-sync');
    const request = require('sync-request');
    const crypto  = require('crypto');
    const xml     = require('xml2js');
    const sleep   = require('sleep');
    const core    = require('mlproj-core');

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The platform implementation for Node.
     */

    class Platform extends core.Platform
    {
        constructor(dry, verbose) {
            super(dry, verbose);
            // try one...
            var proj = Platform.userJson(this, '.mlproj.json');
            if ( proj ) {
                this._config  = proj.config;
                this._connect = proj.connect;
            }
            else {
                // ...or the other
                proj = Platform.userJson(this, 'mlproj.json');
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

        // TODO: To remove...
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

        // TODO: To remove...
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

        // TODO: To remove...
        yellow(s) {
            return chalk.yellow(s);
        }

        red(s) {
            return chalk.red(s);
        }

        // TODO: To remove...
        bold(s) {
            return chalk.bold(s);
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

        requestAuth(method, url, options) {
            const md5 = (name, str) => {
                let res = crypto.createHash('md5').update(str).digest('hex');
                return res;
            };
            const parseDigest = header => {
                if ( ! header || header.slice(0, 7) !== 'Digest ' ) {
                    throw new Error('Expect WWW-Authenticate for digest, got: ' + header);
                }
                return header.substring(7).split(/,\s+/).reduce((obj, s) => {
                    var parts = s.split('=')
                    obj[parts[0]] = parts[1].replace(/"/g, '')
                    return obj
                }, {});
            };
            const renderDigest = params => {
                const attr = (key, quote) => {
                    if ( params[key] ) {
                        attrs.push(key + '=' + quote + params[key] + quote);
                    }
                };
                var attrs = [];
                attr('username',  '"');
                attr('realm',     '"');
                attr('nonce',     '"');
                attr('uri',       '"');
                attr('algorithm', '');
                attr('response',  '"');
                attr('opaque',    '"');
                attr('qop',       '');
                attr('nc',        '');
                attr('cnonce',    '"');
                return 'Digest ' + attrs.join(', ');
            };
            const auth = header => {
                var params = parseDigest(header);
                if ( ! params.qop ) {
                    throw new Error('Not supported: qop is unspecified');
                }
                else if ( params.qop === 'auth-int' ) {
                    throw new Error('Not supported: qop is auth-int');
                }
                else if ( params.qop === 'auth' ) {
                    // keep going...
                }
                else {
                    if ( params.qop.split(/,/).includes('auth') ) {
                        // keep going...
                        params.qop = 'auth';
                    }
                    else {
                        throw new Error('Not supported: qop is ' + params.qop);
                    }
                }
                // TODO: Handle NC and CNONCE
                var nc     = '00000001';
                var cnonce = '4f1ab28fcd820bc5';
                var ha1    = md5('ha1', creds[0] + ':' + params.realm + ':' + creds[1]);
                var ha2    = md5('ha2', method + ':' + path);
                var resp   = md5('response', [ha1, params.nonce, nc, cnonce, params.qop, ha2].join(':'));
                var auth   = {
                    username:  creds[0],
                    realm:     params.realm,
                    nonce:     params.nonce,
                    uri:       path,
                    qop:       params.qop,
                    response:  resp,
                    nc:        nc,
                    cnonce:    cnonce,
                    opaque:    params.opaque,
                    algorithm: params.algorithm
                };
                return renderDigest(auth);
            };
            var resp  = request(method, url, options);
            var i     = 0;
            var creds = this.credentials();
            while ( resp.statusCode === 401 ) {
                if ( ++i > 3 ) {
                    throw new Error('Too many authentications failed: ' + url);
                }
                if ( ! options.headers ) {
                    options.headers = {};
                }
                options.headers.authorization = auth(resp.headers['www-authenticate']);
                resp = request(method, url, options);
            }
            return resp;
        }

        get(api, url) {
            var url     = this.url(api, url);
            var options = {
                headers: {
                    Accept: 'application/json'
                }
            };
            var resp = this.requestAuth('GET', url, options);
            if ( resp.statusCode === 200 ) {
                return JSON.parse(resp.getBody());
            }
            else if ( resp.statusCode === 404 ) {
                return;
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                throw new Error('Error retrieving entity: ' + (resp.body.errorResponse
                                ? resp.body.errorResponse.message : resp.body));
            }
        }

        post(api, url, data) {
            var url     = this.url(api, url);
            var options = {};
            if ( data ) {
                options.json = data;
            }
            else {
                options.headers = {
                    "Content-Type": 'application/x-www-form-urlencoded'
                };
            }
            var resp = this.requestAuth('POST', url, options);
            if ( resp.statusCode === (data ? 201 : 200) ) {
                return;
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                throw new Error('Entity not created: ' + (resp.body.errorResponse
                                ? resp.body.errorResponse.message : resp.body));
            }
        }

        restart(last) {
            var ping;
            var num = 1;
            do {
                sleep.sleep(1);
                if ( ! (num % 3) ) {
                    // TODO: Says "Still waiting...", somehow?
                }
                try {
                    ping = this.requestAuth('GET', this.url('admin', '/timestamp'), {});
                }
                catch ( err ) {
                    ping = err;
                }
            }
            while ( ++num < 10 && (ping.statusCode === 503 || ping.code === 'ECONNRESET' || ping.code === 'ECONNREFUSED') );
            if ( ping.statusCode !== 200 ) {
                throw new Error('Error waiting for server restart: ' + num + ' - ' + ping);
            }
            var now = Date.parse(ping.body);
            if ( last >= now ) {
                throw new Error('Error waiting for server restart: ' + last + ' - ' + now);
            }
        }

        put(api, url, data, type) {
            var url     = this.url(api, url);
            var options = {
                headers: {
                    Accept: 'application/json'
                }
            };
            if ( data ) {
                if ( type ) {
                    options.headers['Content-Type'] = type;
                    options.body                    = data;
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
            var resp = this.requestAuth('PUT', url, options);
            // XDBC PUT /insert returns 200
            if ( resp.statusCode === 200 || resp.statusCode === 201 || resp.statusCode === 204 ) {
                return;
            }
            // when operation needs a server restart
            else if ( resp.statusCode === 202 ) {
                var body = JSON.parse(resp.body).restart;
                if ( ! body ) {
                    throw new Error('202 returned NOT for a restart reason?!?');
                }
                return Date.parse(body['last-startup'][0].value);
            }
            else {
                // TODO: Adapt verboseHttp()...
                // this.verboseHttp(http, body);
                throw new Error('Entity not updated: ' + (resp.body.errorResponse
                                ? resp.body.errorResponse.message : resp.body));
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

    Platform.userJson = (pf, name) => {
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
    };

    class Display extends core.Display
    {
        database(name, id, schema, security, triggers, forests, props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Database') + ': ' + chalk.bold(chalk.yellow(name)));
            id       && line(1, 'id',          id);
            schema   && line(1, 'schema DB',   schema.name);
            security && line(1, 'security DB', security.name);
            triggers && line(1, 'triggers DB', triggers.name);
            if ( forests.length ) {
                line(1, 'forests:');
                forests.forEach(f => line(2, f));
            }
            Object.keys(props).forEach(p => this._property(props[p]));
            log('');
        }

        server(name, id, group, content, modules, props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Server') + ': ' + chalk.bold(chalk.yellow(name)));
            line(1, 'group', group);
            id      && line(1, 'id',         id);
            content && line(1, 'content DB', content.name);
            modules && line(1, 'modules DB', modules.name);
            // explicit list of properties, to guarantee the order they are displayed
            [ 'type', 'port', 'root', 'rewriter', 'handler' ].forEach(p => {
                if ( props[p] !== undefined ) {
                    this._property(props[p]);
                }
            });
            log('');
        }

        _property(prop, level) {
            const line = Display.line;
            if ( ! level ) {
                level = 1;
            }
            if ( Array.isArray(prop.value) ) {
                prop.value.forEach(v => {
                    line(level, prop.prop.label);
                    Object.keys(v).forEach(n => this._property(v[n], level + 1));
                });
            }
            else {
                line(level, prop.prop.label, prop.value);
            }
        }

        project(code, configs, title, name, version) {
            const log  = Display.log;
            const line = Display.line;
            log('');
            log(chalk.bold('Project') + ': ' + chalk.bold(chalk.yellow(code)));
            title   && line(1, 'title',   title);
            name    && line(1, 'name',    name);
            version && line(1, 'version', version);
            // display the config parameters applicable
            configs.forEach(cfg => {
                if ( 'object' === typeof cfg.value ) {
                    line(1, 'cfg.' + cfg.name);
                    Object.keys(cfg.value).forEach(n => {
                        line(2, n, cfg.value[n]);
                    });
                }
                else {
                    line(1, 'cfg.' + cfg.name, cfg.value);
                }
            });
            log('');
        }

        environ(envipath, title, desc, host, user, password, srcdir, mods, params, imports) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Environment') + ': ' + chalk.bold(chalk.yellow(envipath)));
            title    && line(1, 'title',       title);
            desc     && line(1, 'desc',        desc);
            host     && line(1, 'host',        host);
            user     && line(1, 'user',        user);
            password && line(1, 'password',    '*****');
            srcdir   && line(1, 'sources dir', srcdir);
            mods     && line(1, 'modules DB',  mods);
            if ( params.length ) {
                line(1, 'parameters:');
                params.forEach(p => line(2, p.name, p.value));
            }
            if ( imports.length ) {
                line(1, 'import graph:');
                imports.forEach(i => line(i.level + 1, '-> ' + i.href));
            }
            log('');
        }

        check(indent, msg, arg) {
            Display.action(indent, '• ' + chalk.yellow('checking') + ' ' + msg, arg);
        }

        add(indent, verb, msg, arg) {
            Display.action(indent, '  need to ' + chalk.green(verb) + ' ' + msg, arg);
        }

        remove(indent, verb, msg, arg) {
            Display.action(indent, '  need to ' + chalk.red(verb) + ' ' + msg, arg);
        }

        error(e, verbose) {
            switch ( e.name ) {
            case 'server-no-content':
                Display.log(chalk.red('Error') + ': The server ' + e.server + ' has no content DB.');
                Display.log('Are you sure you want to load documents on it?  Check your environ file.');
            case 'server-no-modules':
                Display.log(chalk.red('Error') + ': The server ' + e.server + ' has no modules DB.');
                Display.log('There is no need to deploy when server modules are on the filesystem.');
            default:
                Display.log(chalk.red('Error') + ': ' + e.message);
            }
            if ( verbose ) {
                Display.log(chalk.bold('Stacktrace') + ':');
                Display.log(e.stack);
            }
        }
    }

    Display.log = msg => {
        console.log(msg);
    };

    Display.indent = level => {
        var s = '';
        while ( level-- ) {
            s += '   ';
        }
        return s;
    };

    Display.line = (indent, name, value) => {
        var s = Display.indent(indent);
        s += name;
        if ( value !== undefined ) {
            const PAD = '                        '; // 24 spaces
            s += ': ' + PAD.slice(s.length) + value;
        }
        Display.log(s);
    };

    Display.action = (indent, msg, arg) => {
        var s = Display.indent(indent);
        s += msg;
        if ( arg ) {
            s += ': \t' + arg;
        }
        Display.log(s);
    };

    module.exports = {
        Platform : Platform,
        Display  : Display
    }
}
)();
