"use strict";

(function() {

    const act = require('./action');
    const cmp = require('./components');
    const s   = require('./space');

    /*~
     * The base class/interface for commands.
     */
    class Command
    {
        constructor(project) {
            this.project = project;
        }
        execute() {
            throw new Error('Command.execute is abstract');
        }
    }

    /*~
     * Create a new project.
     */
    class NewCommand extends Command
    {
        constructor(platform, args) {
            super();
            this.platform = platform;
            this.dir      = args.dir;
            this.abbrev   = args.abbrev;
            this.title    = args.title;
            this.name     = args.name;
            this.version  = args.version;
            this.port     = args.port;
        }

        execute() {
            var pf = this.platform;

            // create `src/`
            // TODO: Create `test/` as well, when supported.
            var srcdir = pf.resolve('src', this.dir);
            pf.mkdir(srcdir);

            // create `xproject/` and `xproject/project.xml`
            var xpdir = pf.resolve('xproject', this.dir);
            pf.mkdir(xpdir);
            pf.write(pf.resolve('project.xml', xpdir), NEW_PROJECT_XML(this));

            // create `xproject/mlenvs/` and `xproject/mlenvs/{base,default,dev,prod}.json`
            var mldir = pf.resolve('mlenvs', xpdir);
            pf.mkdir(mldir);
            pf.write(pf.resolve('base.json',    mldir), NEW_BASE_ENV(this));
            pf.write(pf.resolve('default.json', mldir), NEW_DEFAULT_ENV(this));
            pf.write(pf.resolve('dev.json',     mldir), NEW_DEV_ENV(this));
            pf.write(pf.resolve('prod.json',    mldir), NEW_PROD_ENV(this));

            return xpdir;
        }
    }

    /*~
     * Display the resolved space.
     */
    class ShowCommand extends Command
    {
        execute() {
            var pf    = this.project.platform;
            var space = this.project.space;
            var components = comps => {
                comps.forEach(c => {
                    c.show(pf);
                    pf.log('');
                });
            };
            pf.log('');
            this.showProject(pf);
            this.showEnviron(pf);
            components(space.databases());
            components(space.servers());
        }

        showProject(pf) {
            var p = this.project;
            pf.log(pf.bold('Project') + ': ' + pf.bold(pf.yellow(p.space.param('@code'))));
            p.title   && pf.line(1, 'title',   p.title);
            p.name    && pf.line(1, 'name',    p.name);
            p.version && pf.line(1, 'version', p.version);
            // display the config parameters applicable
            this.project.configs().forEach(c => {
                var cfg = this.project.config(c)
                if ( 'object' === typeof cfg ) {
                    pf.line(1, 'cfg.' + c);
                    Object.keys(cfg).forEach(n => {
                        pf.line(2, n, cfg[n]);
                    });
                }
                else {
                    pf.line(1, 'cfg.' + c, cfg);
                }
            });
            pf.log('');
        }

        showEnviron(pf) {
            var space = this.project.space;
            const imports = (space, level) => {
                space._imports.forEach(i => {
                    pf.line(level, '-> ' + i.href);
                    imports(i.space, level + 1);
                });
            };
            var mods;
            try {
                mods = space.modulesDb().name;
            }
            catch (e) {
                if ( /no server/i.test(e.message) ) {
                    // nothing
                }
                else if ( /more than 1/i.test(e.message) ) {
                    mods = '(more than 1 server)';
                }
                else if ( /no modules/i.test(e.message) ) {
                    mods = '(filesystem)';
                }
                else {
                    throw e;
                }
            }
            pf.log(pf.bold('Environment') + ': '
                   + pf.bold(pf.yellow(this.project.environ || this.project.path)));
            [ 'title', 'desc', 'host', 'user' ].forEach(p => {
                var v = space.param('@' + p);
                v && pf.line(1, p, v);
            });
            space.param('@password') && pf.line(1, 'password', '*****');
            pf.line(1, 'sources dir', space.param('@srcdir'));
            mods && pf.line(1, 'modules DB', mods);
            var params = space.params();
            if ( params.length ) {
                pf.line(1, 'parameters:');
                params.forEach(p => pf.line(2, p, space.param(p)));
            }
            if ( space._imports.length ) {
                pf.line(1, 'import graph:');
                imports(space, 2);
            }
            pf.log('');
        }
    }

    /*~
     * Create the components from the space on MarkLogic.
     */
    class SetupCommand extends Command
    {
        execute()
        {
            var pf    = this.project.platform;
            var space = this.project.space;
            pf.log('--- ' + pf.bold('Prepare') + ' ---');
            // the action list
            this.actions = new act.ActionList(pf);
            var impl = comps => {
                if ( comps.length ) {
                    comps[0].setup(this.actions, () => impl(comps.slice(1)));
                }
                else {
                    doit();
                }
            };
            var doit = () => {
                pf.log('\n--- ' + pf.bold('Progress') + ' ---'
                       + (pf.dry ? ' (' + pf.red('dry run, not for real') + ')' : ''));
                this.actions.execute(summary);
            };
            var summary = () => {
                pf.log('\n--- ' + pf.bold('Summary') + ' ---'
                       + (pf.dry ? ' (' + pf.red('dry run, not for real') + ')' : ''));
                this.actions.summary();
            };
            var dbs  = space.databases();
            var srvs = space.servers();
            impl(dbs.concat(srvs));
        }
    }

    /*~
     * Load documents to a database.
     */
    class LoadCommand extends Command
    {
        isDeploy() {
            return false;
        }

        execute(args) {
            // "global" variables
            var pf    = this.project.platform;
            var space = this.project.space;
            this.actions = new act.ActionList(pf);

            // utility: resolve the target db from args
            var target = function(args, isDeploy) {
                var as    = args.server;
                var db    = args.database;
                var force = args.forceDb;
                // if no explicit target, try defaults
                if ( ! as && ! db && ! force ) {
                    var srvs = space.servers();
                    if ( srvs.length === 1 ) {
                        as = srvs[0];
                    }
                    else if ( isDeploy ) {
                        throw new Error('Not exactly one server in the environ');
                    }
                    else {
                        var dbs = space.databases();
                        if ( dbs.length === 1 ) {
                            db = dbs[0];
                        }
                        else {
                            throw new Error('Not exactly one server or database in the environ');
                        }
                    }
                }
                // if more than one explicit
                if ( (as && db) || (as && force) || (db && force) ) {
                    throw new Error('Both target options @db and @as provided');
                }
                // resolve from server if set
                else if ( as ) {
                    db = isDeploy
                        ? as.modules
                        : as.content;
                    if ( ! db ) {
                        throw new Error('Server has no ' + (isDeploy ? 'modules' : 'content')
                                        + ' database: ' + as.name);
                    }
                }
                // resolve from defined databases
                else if ( db ) {
                    db = space.database(db);
                }
                // force the db name, e.g. for system databases
                else {
                    db = new cmp.SysDatabase(force);
                }
                return db;
            };

            // TODO: It should be possible to attach a srcdir to a db as well
            // (like data/ to content, schemas/ to schemas, src/ to modules...)
            //
            // So the commands "mlproj load schemas", "mlproj load @src schemas"
            // and "mlproj load @db schemas" are all the same...
            //
            // And of course to be able to set an extension loader in JS...  See
            // "invoker" for an example.
            //
            // utility: resolve the content source from args
            var content = function(args, isDeploy) {
                var src = args.sourceset;
                var dir = args.directory;
                var doc = args.document;
                // if no explicit target, try defaults
                if ( ! src && ! dir && ! doc ) {
                    var arg = isDeploy ? 'src' : 'data'; // default value
                    if ( args.what ) {
                        arg = args.what;
                    }
                    // TODO: For now, if "@srcdir", simulate a srcdir with the
                    // same value as dir, and "src" as name.  Must eventually
                    // support multiple named srcdirs...
                    //
                    // TODO: In addition to a srcdir by name, what if we look if
                    // there is a srcdir attached to a directory equal to "arg"?
                    // Won't change the dir used, but might make a difference if
                    // we use other props on the srcdir...
                    //
                    // src = space.srcdir(arg);
                    // if ( ! src ) {
                    //     dir = arg;
                    // }
                    if ( arg === 'src' && space.param('@srcdir') ) {
                        src = 'src';
                    }
                    else {
                        dir = arg;
                    }
                }
                // if two explicit at same time
                if ( (src && dir) || (src && doc) || (dir && doc) ) {
                    throw new Error('Content options @src, @dir and @doc ar mutually exclusive');
                }
                return src ? { src: src }
                     : dir ? { dir: dir }
                     :       { doc: doc };
            }

            // do it: the actual execute() implem
            let db   = target(args, this.isDeploy());
            let what = content(args, this.isDeploy());
            let dir  = what.dir;
            let doc  = what.doc;
            if ( what.src ) {
                // TODO: For now, the srcdir with name "src" is simulated with
                // the value of the param "@srcdir".  Must eventually support
                // multiple named srcdirs...
                if ( what.src !== 'src' ) {
                    throw new Error('Multiple srcdirs not supported yet, only "src": ' + src);
                }
                dir = space.param('@srcdir');
            }

            let paths = [];
            if ( doc ) {
                let idx = doc.indexOf('/');
                if ( idx < 0 ) {
                    throw new Error('Path in `load doc` must contain at least 1 parent dir');
                }
                let uri = doc.slice(idx);
                paths.push({
                    path : doc,
                    uri  : uri
                });
            }
            else {
                pf.allFiles(dir).forEach(p => {
                    let uri;
                    if ( dir === '.' || dir === './' ) {
                        uri = '/' + p;
                    }
                    else {
                        let len = dir.endsWith('/') ? dir.length - 1 : dir.length;
                        uri = p.slice(len);
                    }
                    paths.push({
                        path : p,
                        uri  : uri
                    });
                });
            }

            paths.forEach(p => {
                // TODO: read() uses utf-8, cannot handle binary
                this.actions.add(
                    new act.DocInsert(db, p.uri, pf.read(p.path)));
            });
            this.actions.execute(() => {
                this.actions.summary(true);
            });
        }
    }

    /*~
     * Deploy modules to a database.
     */
    class DeployCommand extends LoadCommand
    {
        isDeploy() {
            return true;
        }
    }

    // helper function for the command `new`, to create xproject/project.xml
    function NEW_PROJECT_XML(vars)
    {
        return `<project xmlns="http://expath.org/ns/project"
         name="${ vars.name }"
         abbrev="${ vars.abbrev }"
         version="${ vars.version }">

   <title>${ vars.title }</title>

</project>
`;
    }

    // helper function for the command `new`, to create xproject/ml/base.json
    function NEW_BASE_ENV(vars)
    {
        return `{
    "mlproj": {
        "format": "0.1",
        "params": {
            "port": "${ vars.port }"
        },
        "databases": [{
            "id": "content",
            "name": "@{code}-content"
        }],
        "servers": [{
            "id": "app",
            "name": "@{code}",
            "type": "http",
            "port": "\${port}",
            "content": {
                "idref": "content"
            }
        }]
    }
}
`;
    }

    // helper function for the command `new`, to create xproject/ml/default.json
    function NEW_DEFAULT_ENV(vars)
    {
        return `{
    "mlproj": {
        "format": "0.1",
        "import": "dev.json"
    }
}
`;
    }

    // helper function for the command `new`, to create xproject/ml/dev.json
    function NEW_DEV_ENV(vars)
    {
        return `{
    "mlproj": {
        "format": "0.1",
        "import": "base.json",
        "connect": {
            "host": "localhost",
            "user": "admin",
            "password": "admin"
        }
    }
}
`;
    }

    // helper function for the command `new`, to create xproject/ml/prod.json
    function NEW_PROD_ENV(vars)
    {
        return `{
    "mlproj": {
        "format": "0.1",
        "import": "base.json",
        "connect": {
            "host": "prod.server",
            "user": "admin"
        },
        "databases": [{
            "id": "modules",
            "name": "@{code}-modules"
        }],
        "servers": [{
            "id": "app",
            "modules": {
                "idref": "modules"
            },
            "root": "/"
        }]
    }
}
`;
    }

    module.exports = {
        NewCommand    : NewCommand,
        ShowCommand   : ShowCommand,
        SetupCommand  : SetupCommand,
        LoadCommand   : LoadCommand,
        DeployCommand : DeployCommand
    }
}
)();
