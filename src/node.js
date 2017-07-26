"use strict";

(function() {

    const fs       = require('fs');
    const os       = require('os');
    const path     = require('path');
    const chalk    = require('chalk');
    const read     = require('readline-sync');
    const request  = require('sync-request');
    const crypto   = require('crypto');
    const xml      = require('xml2js');
    const sleep    = require('sleep');
    const chokidar = require('chokidar');
    const core     = require('mlproj-core');

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The watch command, specific to the Node frontend.
     */

    class WatchCommand extends core.LoadCommand
    {
        isDeploy() {
            return true;
        }

        populateActions(actions, db, src) {
            var path      = src.doc;
            var recursive = false;
            var msg       = 'Watch source file';
            if ( ! path ) {
                path      = src.prop('dir');
                recursive = true;
                msg       = 'Watch source directory';
            }
            actions.add(new WatchAction(msg, db, path, recursive, (d, p) => src.uri(d, p)));
        }
    }

    class WatchAction extends core.actions.Action
    {
        constructor(msg, db, path, recursive, uri) {
            super(msg);
            this.db        = db;
            this.path      = path.replace(/\\/g, '/');
            this.recursive = recursive;
            this.uri       = uri;
        }

        // TODO: Apply the same filtering logic here as in DeployCommand (and
        // share the mecanism with LoadCommand as well), once implemented...
        execute(platform) {
            platform.warn(platform.yellow('→') + ' ' + this.msg + ': \t' + this.path);
            chokidar.watch(this.path, {
                ignored: /(^|[\/\\])\../,
                persistent: true,
                ignoreInitial: true
            })
                .on('add', path => {
                    this.insert(path, platform);
                })
                .on('change', path => {
                    this.insert(path, platform);
                })
                .on('unlink', path => {
                    platform.log(`TODO: File ${path} has been removed, delete it!`);
                })
                .on('error', error => {
                    platform.log('Watcher error: ' + error.filename);
                })
                .on('ready', () => {
                    platform.warn(
                        platform.green('✓')
                        + ' Watching for changes, target is ' + this.db.name + '...');
                })
                // raw event details, for debugging...
                // .on('raw', (event, path, details) => {
                //     platform.log(`Raw event info: ${event}, ${path}, ${details}`);
                // })
            ;
        }

        insert(path, platform) {
            var uri = this.uri(this.path, path.replace(/\\/g, '/'));
            var act = new core.actions.DocInsert(this.db, uri, path);
            act.execute(platform);
        }
    }

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The platform implementation for Node.
     */

    class Context extends core.Context
    {
        constructor(dry, verbose) {
            const json = f => {
                try {
                    return Platform.userJson(f);
                }
                catch (err) {
                    // just ignore when the file does not exust
                    if ( err.name !== 'no-such-file' ) {
                        throw err;
                    }
                }
            };
            // try one config file or the other
            var conf = json('.mlproj.json') || json('mlproj.json');
            // instantiate the base object
            super(new Display(verbose), new Platform(), conf, dry, verbose);
        }
    }

    class Platform extends core.Platform
    {
        constructor() {
            super(process.cwd());
        }

        mkdir(path, force) {
            try {
                fs.mkdirSync(path);
            }
            catch ( err ) {
                if ( force && err.code === 'EEXIST' ) {
                    // ignore
                }
                else {
                    throw err;
                }
            }
        }

        debug(msg) {
            console.log('DEBUG: ' + msg);
        }

        // TODO: To remove...
        log(msg) {
            console.log(msg);
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
            return Platform.staticResolve(href, base);
        }

        read(path) {
            try {
                return fs.readFileSync(path, 'utf8');
            }
            catch (err) {
                if ( err.code === 'ENOENT' ) {
                    throw core.error.noSuchFile(path);
                }
                else {
                    throw err;
                }
            }
        }

        projectXml(path) {
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
                // the following page makes it clear it is not async, just using
                // a callback, synchronously:
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

        write(path, content, force) {
            if ( ! force ) {
                try {
                    // just to detect if file exists
                    fs.statSync(path);
                }
                catch (err) {
                    // ignore ENOENT, file does not exist
                    if ( err.code !== 'ENOENT' ) {
                        throw err;
                    }
                }
            }
            fs.writeFileSync(path, content, 'utf8');
        }

        // TODO: To remove...
        green(s) {
            return chalk.green(s);
        }

        // TODO: To remove...
        yellow(s) {
            return chalk.yellow(s);
        }

        // TODO: To remove...
        bold(s) {
            return chalk.bold(s);
        }

        credentials() {
            // set in Environ ctor, find a nicer way to pass the info
            if ( ! this.environ ) {
                throw new Error('No environ set on the platform for credentials');
            }
            var user = this.environ.param('@user');
            var pwd  = this.environ.param('@password');
            if ( ! user ) {
                throw new Error('No user in environ');
            }
            if ( ! pwd ) {
                // ask for password interactively first time it is used
                pwd = read.question('Password: ', { hideEchoBack: true });
                this.environ.param('@password', pwd);
            }
            return [ user, pwd ];
        }

        requestAuth(method, url, options) {
            const md5 = (name, str) => {
                return crypto.createHash('md5').update(str).digest('hex');
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

                // TODO: `path` not properly provisionned?!?
                // How could it work?!? (path refers to require('path'), here)
                // Get it from `url`? (from and after first '/'..., or 3d, because of http://...?)

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
                throw new Error('Entity not created: ' + (resp.body.errorResponse
                                ? resp.body.errorResponse.message : resp.body));
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
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
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
                throw new Error('Entity not updated: ' + (resp.body.errorResponse
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

        dirChildren(dir) {
            var res = [];
            fs.readdirSync(dir).forEach(child => {
                const p = this.resolve(child, dir);
                const s = fs.statSync(p);
                // TODO: Do something with `s.isSymbolicLink()`?
                if ( s.isBlockDevice() || s.isCharacterDevice() || s.isFIFO() || s.isSocket() ) {
                    return;
                }
                var f = {
                    name : child,
                    path : path.join(dir, child)
                };
                if ( s.isDirectory() ) {
                    f.files = [];
                }
                res.push(f);
            });
            return res;
        }

        isDirectory(path) {
            try {
                return fs.statSync(path).isDirectory();
            }
            catch (err) {
                if ( err.code === 'ENOENT' ) {
                    throw core.error.noSuchFile(path);
                }
                else {
                    throw err;
                }
            }
        }

        static staticResolve(href, base) {
            if ( ! base ) {
                base = '.';
            }
            return path.resolve(base, href);
        }

        static userJson(name) {
            try {
                let path = Platform.staticResolve(name, os.homedir());
                let text = fs.readFileSync(path, 'utf8');
                let json = JSON.parse(text);
                return json.mlproj;
            }
            catch (err) {
                // ignore ENOENT, file does not exist
                if ( err.code !== 'ENOENT' ) {
                    throw err;
                }
            }
        }
    }

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The display implementation for Node.
     */

    class Display extends core.Display
    {
        constructor(verbose) {
            super(verbose);
        }

        // TODO: FIXME: ...
        info(msg) {
            if ( this.verbose ) {
                console.log(chalk.yellow('Info') + ': ' + msg);
            }
        }

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

        source(name, props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Source') + ': ' + chalk.bold(chalk.yellow(name)));
            Object.keys(props).forEach(p => this._property(props[p]));
            log('');
        }

        _property(prop, level) {
            const line = Display.line;
            if ( ! level ) {
                level = 1;
            }
            if ( prop.prop.multiline ) {
                prop.value.forEach(v => {
                    line(level, prop.prop.label);
                    Object.keys(v).forEach(n => this._property(v[n], level + 1));
                });
            }
            else if ( Array.isArray(prop.value) ) {
                line(level, prop.prop.label, prop.value.join(', '));
            }
            else {
                line(level, prop.prop.label, prop.value);
            }
        }

        project(abbrev, configs, title, name, version) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Project') + ': ' + chalk.bold(chalk.yellow(abbrev)));
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

        environ(envipath, title, desc, host, user, password, params, imports) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Environment') + ': ' + chalk.bold(chalk.yellow(envipath)));
            title    && line(1, 'title',       title);
            desc     && line(1, 'desc',        desc);
            host     && line(1, 'host',        host);
            user     && line(1, 'user',        user);
            password && line(1, 'password',    '*****');
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
                break;
            case 'server-no-modules':
                Display.log(chalk.red('Error') + ': The server ' + e.server + ' has no modules DB.');
                Display.log('There is no need to deploy when server modules are on the filesystem.');
                break;
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
        Context      : Context,
        Display      : Display,
        Platform     : Platform,
        WatchCommand : WatchCommand
    }
}
)();
