"use strict";

(function() {

    const buf      = require('buffer');
    const fs       = require('fs');
    const os       = require('os');
    const path     = require('path');
    const chalk    = require('chalk');
    const read     = require('readline-sync');
    const request  = require('sync-request');
    const uuid     = require('uuid');
    const crypto   = require('crypto');
    const xml      = require('xml2js');
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

        populateActions(actions, db, src, srv) {
            // simple file
            if ( src.doc ) {
                actions.add(new WatchAction('Watch source file', db, src.doc, false, (path, root, ctxt) => {
                    this.insert(path, root, db, ctxt);
                }));
            }
            // rest dir
            else if ( src.type === 'rest-src' ) {
                const pf         = actions.ctxt.platform;
                const dir        = src.prop('dir');
                const port       = (srv || src.restTarget()).props.port.value;
                const root       = dir + '/root';
                const services   = dir + '/services';
                const transforms = dir + '/transforms';
                if ( pf.exists(root) ) {
                    actions.add(new WatchAction('Watch source directory', db, root, true, (path, root, ctxt) => {
                        this.insert(path, root, db, ctxt);
                    }));
                }
                if ( pf.exists(services) ) {
                    actions.add(new WatchAction('Watch services directory', db, services, true, (path, root, ctxt) => {
                        this.install(path, root, src, 'resources', port, ctxt);
                    }));
                }
                if ( pf.exists(transforms) ) {
                    actions.add(new WatchAction('Watch transforms directory', db, transforms, true, (path, root, ctxt) => {
                        this.install(path, root, src, 'transforms', port, ctxt);
                    }));
                }
            }
            // plain dir
            else {
                const dir = src.prop('dir');
                actions.add(new WatchAction('Watch source directory', db, dir, true, (path, root, ctxt) => {
                    this.insert(path, root, db, ctxt);
                }));
            }
        }

        insert(path, root, db, ctxt) {
            try {
                var uri = path.replace(/\\/g, '/').slice(root.length);
                var act = new core.actions.DocInsert(db, uri, path);
                act.execute(ctxt);
            }
            catch ( err ) {
                ctxt.display.error(err, ctxt.display.verbose);
            }
        }

        install(path, root, src, kind, port, ctxt) {
            try {
                var filename = path.replace(/\\/g, '/').slice(root.length + 1);
                let act      = src.installRestThing(port, kind, filename, path);
                act.execute(ctxt);
            }
            catch ( err ) {
                ctxt.display.error(err, ctxt.display.verbose);
            }
        }
    }

    class WatchAction extends core.actions.Action
    {
        constructor(msg, db, path, recursive, onMatch) {
            super(msg);
            this.db        = db;
            this.path      = path.replace(/\\/g, '/');
            this.recursive = recursive;
            this.onMatch   = onMatch;
        }

        // TODO: Apply the same filtering logic here as in DeployCommand (and
        // share the mecanism with LoadCommand as well), once implemented...
        execute(ctxt) {
            const pf = ctxt.platform;
            pf.warn(pf.yellow('→') + ' ' + this.msg + ': \t' + this.path);
            chokidar.watch(this.path, {
                ignored: /(^|[\/\\])\../,
                persistent: true,
                ignoreInitial: true
            })
                .on('add', path => {
                    this.onMatch(path, this.path, ctxt);
                })
                .on('change', path => {
                    this.onMatch(path, this.path, ctxt);
                })
                .on('unlink', path => {
                    pf.log(`TODO: File ${path} has been removed, delete it!`);
                })
                .on('error', error => {
                    pf.log('Watcher error: ' + error.filename);
                })
                .on('ready', () => {
                    pf.warn(
                        pf.green('✓')
                        + ' Watching for changes, target is ' + this.db.name + '...');
                })
                // raw event details, for debugging...
                // .on('raw', (event, path, details) => {
                //     pf.log(`Raw event info: ${event}, ${path}, ${details}`);
                // })
            ;
        }
    }

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The context implementation for Node.
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

    /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     * The platform implementation for Node.
     */

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

        read(path, encoding) {
            try {
                return fs.readFileSync(path, encoding);
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
            if ( ! force && this.exists(path) ) {
                throw new Error('File already exists, do not override: ' + path);
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
        red(s) {
            return chalk.red(s);
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
                    var eq = s.indexOf('=');
                    if ( eq === -1 ) {
                        throw new Error('Digest parsing: param with no equal sign: ' + s);
                    }
                    var name  = s.slice(0, eq);
                    var value = s.slice(eq + 1);
                    obj[name] = value.replace(/"/g, '')
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
                var nc     = '00000002';
                var cnonce = '4f1ab28fcd820bc6';
                var ha1    = md5('ha1', creds[0] + ':' + params.realm + ':' + creds[1]);

                var path;
                if ( url.startsWith('http://') ) {
                    path = url.slice(7);
                }
                else if ( url.startsWith('https://') ) {
                    path = url.slice(8);
                }
                else {
                    throw new Error('URL is neither HTTP or HTTPS: ' + url);
                }
                var slash = path.indexOf('/');
                path = slash === -1
                    ? '/'
                    : path.slice(slash);

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

        extractBody(resp) {
            let body  = resp.body;
            let ctype = resp.headers && body.length && resp.headers['content-type'];
            if ( ctype ) {
                // TODO: Parse it properly, e.g. "application/json; charset=UTF-8"
                if ( ctype.startsWith('application/json') ) {
                    body = JSON.parse(body);
                }
                // TODO: Parse it properly, e.g. "application/xml; charset=UTF-8"
                else if ( ctype.startsWith('application/xml') ) {
                    body = body.toString();
                }
            }
            return body;
        }

        get(params, path) {
            //let tracer  = new HttpTracer();
            //tracer.params(params, path);
            let url     = this.url(params, path);
            let options = {};
            options.headers = params.headers || {};
            if ( options.headers.accept === undefined ) {
                options.headers.accept = 'application/json';
            }
            //tracer.request('GET', url, options);
            let resp   = this.requestAuth('GET', url, options);
            let result = {
                status  : resp.statusCode,
                headers : resp.headers,
                body    : this.extractBody(resp)
            };
            //tracer.response(result);
            return result;
        }

        post(params, path, data, mime) {
            //let tracer  = new HttpTracer();
            //tracer.params(params, path, data, mime);
            let url     = this.url(params, path);
            let options = {};
            options.headers = params.headers || {};
            let body    = data || params.body;
            let type    = mime || params.type || options.headers['content-type'];
            if ( ! options.headers.accept ) {
                options.headers.accept = 'application/json';
            }
            if ( body && type ) {
                options.headers['content-type'] = type;
                options.body                    = body;
            }
            else if ( body ) {
                options.json = body;
            }
            else {
                options.headers['content-type'] = 'application/x-www-form-urlencoded';
            }
            //tracer.request('POST', url, options);
            let resp   = this.requestAuth('POST', url, options);
            let result = {
                status  : resp.statusCode,
                headers : resp.headers,
                body    : this.extractBody(resp)
            };
            //tracer.response(result);
            return result;
        }

        put(params, path, data, mime) {
            //let tracer  = new HttpTracer();
            //tracer.params(params, path, data, mime);
            let url     = this.url(params, path);
            let body    = data || params.body;
            let type    = mime || params.type;
            let options = {};
            options.headers = params.headers || {};
            if ( ! options.headers.accept ) {
                options.headers.accept = 'application/json';
            }
            if ( body && type ) {
                options.headers['content-type'] = type;
                options.body                    = body;
            }
            else if ( body ) {
                options.json = body;
            }
            else {
                options.headers['content-type'] = 'application/x-www-form-urlencoded';
            }
            //
            // TODO: Create a proper debug level selection mechanism, with the
            // ability to say, on the command line: "log the HTTP requests, log
            // the responses, log the URLs, the headers, the payloads, log the
            // actions with their data, log the file selections, log everything,
            // etc."
            //
            //tracer.request('PUT', url, options);
            let resp   = this.requestAuth('PUT', url, options);
            let result = {
                status  : resp.statusCode,
                headers : resp.headers,
                body    : this.extractBody(resp)
            };
            //tracer.response(result);
            return result;
        }

        boundary() {
            return uuid();
        }

        /*~
         * The parameter `parts` is an array of objects.  Each is either a
         * document:
         *
         *     { uri: '/uri/to/use.xml', path: '/path/on/fs/file.xml' }
         *
         * or a metadata part (with optional `uri`, and `body` as metadata part
         * in http://docs.marklogic.com/guide/rest-dev/bulk):
         *
         *     { body: collections: [ '/some/coll' ] }
         *
         * The difference between both is done by looking at the presence (or
         * absence) of `path`.
         */
        multipart(boundary, parts) {
            let mp = new Multipart(boundary);
            parts.forEach(part => {
                if ( part.path ) {
                    //mp.header('Content-Type', 'foo/bar');
                    mp.header('Content-Disposition', 'attachment; filename="' + part.uri + '"');
                    mp.body(this.read(part.path));
                }
                else {
                    if ( part.uri ) {
                        mp.header('Content-Disposition', 'attachment; filename="' + part.uri + '"; category=metadata');
                    }
                    else {
                        mp.header('Content-Disposition', 'inline; category=metadata');
                    }
                    mp.header('Content-Type', 'application/json');
                    mp.body(JSON.stringify(part.body));
                }
            });
            return mp.payload();
        }

        restart(last) {
            const maxNum  =  2500;
            const maxWait = 60000; // in ms = 1 min
            let ping;
            let num = 1;
            let start = new Date();
            do {
                try {
                    ping = this.requestAuth('GET', this.url({ api: 'admin' }, '/timestamp'), {});
                }
                catch ( err ) {
                    ping = err;
                }
            }
            while ( ++num < maxNum
                    && ((new Date() - start) < maxWait)
                    && (ping.statusCode === 503
                        || ping.code === 'ECONNRESET'
                        || ping.code === 'ECONNREFUSED') );
            if ( ping.statusCode !== 200 ) {
                throw new Error('Error waiting for server restart, not OK: ' + num + ' - ' + ping
                                + ' (tried ' + num + ' times in ' + (new Date() - start) + ' ms)');
            }
            var now = Date.parse(ping.body);
            if ( last >= now ) {
                throw new Error('Error waiting for server restart, wrong times: ' + last + ' - ' + now
                                + ' (tried ' + num + ' times in ' + (new Date() - start) + ' ms)');
            }
        }

        exists(path) {
            return fs.existsSync(path);
        }

        isDirectory(path) {
            if ( ! this.exists(path) ) {
                throw core.error.noSuchFile(path);
            }
            return fs.statSync(path).isDirectory();
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
                    f.isdir = true;
                }
                res.push(f);
            });
            return res;
        }

        static staticResolve(href, base) {
            return path.resolve(base || '.', href);
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

    // Private variable for HttpTracer.
    // TODO: Allow to set it in a config file and on the command line...
    const TRACEDIR = '/tmp/mlproj-trace/';

    // Private class for Platform.get(), .post() and .put().
    class HttpTracer
    {
        constructor() {
            // the stamp to use for this request/response pair
            this.stamp  = HttpTracer.now();
        }

        // common implementation to trace parameters, a request or a response
        trace(type, obj, body) {
            // write a file synchronously
            const write = (path, content) => {
                let fd = fs.openSync(HttpTracer.dir() + path, 'wx');
                fs.writeSync(fd, content);
                fs.fsyncSync(fd);
            };
            // log the http entity, and maybe its body
            let base = this.stamp + '-' + type;
            write(base + '.json', JSON.stringify(obj));
            if ( body instanceof buf.Buffer ) {
                write(base + '.bin', body);
            }
        }

        params(params, path, data, mime) {
            const obj = {
                params:  params,
                path:    path,
                data:    data,
                mime:    mime
            };
            // do not include data if it is a (binary) buffer
            if ( data instanceof buf.Buffer ) {
                let msg = '<excluded because it is a binary buffer, of length ' + data.length + '>';
                obj.data = { excluded: msg };
            }
            // trace the parameters
            this.trace('params', obj, data);
        }

        request(verb, url, options) {
            const obj = {
                verb:    verb,
                url:     url,
                options: options
            };
            // do not include options.body if it is a (binary) buffer
            if ( options && options.body instanceof buf.Buffer ) {
                // do not alter the `options` object in place, caller owns it, so make a copy first
                obj.options = {};
                Object.keys(options).forEach(k => obj.options[k] = options[k]);
                let msg = '<excluded because it is a binary buffer, of length ' + options.body.length + '>';
                obj.options.body = { excluded: msg };
            }
            // trace the request
            this.trace('request', obj, options.body);
        }

        response(res) {
            let obj = res;
            // do not include res.body if it is a (binary) buffer
            if ( obj.body instanceof buf.Buffer ) {
                // do not alter the `res` object in place, caller owns it, so make a copy first
                obj = {};
                Object.keys(res).forEach(k => obj[k] = res[k]);
                let msg = '<excluded because it is a binary buffer, of length ' + res.body.length + '>';
                obj.body = { excluded: msg };
            }
            // trace the response
            this.trace('response', obj, res.body);
        }
    }

    HttpTracer.dir = () => {
        if ( ! HttpTracer.traceDir ) {
            HttpTracer.traceDir = TRACEDIR + HttpTracer.now() + '/';
            fs.mkdirSync(HttpTracer.traceDir);
        }
        return HttpTracer.traceDir;
    };

    HttpTracer.now = () => {
        return new Date().toISOString().replace(/:|\./g, '-');
    };

    // Private variable for Multipart.
    const NL = '\r\n';

    // Private class for Platform.multipart().
    class Multipart
    {
        constructor(boundary) {
            this.boundary = boundary;
            // parts is an array of { headers: string, body: string-or-buffer }
            this.parts    = [];
            this.headers  = [];
        }

        contentType() {
            return 'multipart/mixed; boundary=' + this.boundary;
        }

        header(name, value) {
            this.headers.push(name + ': ' + value);
        }

        body(content) {
            let preamble =
                '--' + this.boundary + NL
                + this.headers.reduce((res, h) => res + h + NL, '')
                + NL;
            this.parts.push({ headers: preamble, body: content });
            this.headers = [];
        }

        payload() {
            let end ='--' + this.boundary + '--' + NL;
            let len =
                this.parts.reduce((res, p) => {
                    let hlen = Buffer.byteLength(p.headers);
                    let blen = Buffer.byteLength(p.body);
                    return res + hlen + blen + 2;
                }, 0)
                + Buffer.byteLength(end);
            let buf = new Buffer(len);
            let pos = 0;
            this.parts.forEach(p => {
                pos += buf.write(p.headers, pos);
                pos += Buffer.isBuffer(p.body)
                    ? p.body.copy(buf, pos)
                    : buf.write(p.body, pos);
                pos += buf.write(NL, pos);
            });
            buf.write(end, pos);
            return buf;
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

        sysDatabase(name) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Database') + ': ' + chalk.bold(chalk.yellow(name)));
            line(1, '(nothing to show, handled outside of the project)');
            log('');
        }

        server(name, id, type, group, content, modules, props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('Server') + ': ' + chalk.bold(chalk.yellow(name)));
            line(1, 'type',  type);
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

        mimetype(name, props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('MIME type') + ': ' + chalk.bold(chalk.yellow(name)));
            Object.keys(props).forEach(p => this._property(props[p]));
            log('');
        }

        user(props) {
            const log  = Display.log;
            const line = Display.line;
            log(chalk.bold('user') + ': ' + chalk.bold(chalk.yellow(props['user-name'].value)));
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

        environ(envipath, title, desc, host, user, password, params, apis, commands, imports) {
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
            if ( Object.keys(apis).length ) {
                line(1, 'apis:');
                Object.keys(apis).forEach(name => {
                    line(2, name + ':');
                    let api = apis[name];
                    Object.keys(api).forEach(p => line(3, p, api[p]));
                });
            }
            if ( commands.length ) {
                line(1, 'commands:');
                commands.forEach(c => line(2, c));
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

        error(err) {
            Display.error(err, this.verbose);
        }
    }

    Display.error = (err, verbose) => {
        switch ( err.name ) {
        case 'server-no-content':
            Display.log(chalk.red('Error') + ': The server ' + err.server + ' has no content DB.');
            Display.log('Are you sure you want to load documents on it?  Check your environ file.');
            break;
        case 'server-no-modules':
            Display.log(chalk.red('Error') + ': The server ' + err.server + ' has no modules DB.');
            Display.log('There is no need to deploy when server modules are on the filesystem.');
            break;
        default:
            Display.log(chalk.red('Error') + ': ' + err.message);
        }
        if ( verbose ) {
            Display.log();
            Display.log(chalk.bold('Stacktrace') + ':');
            Display.log(err.stack);
        }
    };

    Display.log = msg => {
        if ( msg === undefined ) {
            console.log();
        }
        else {
            console.log(msg);
        }
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
