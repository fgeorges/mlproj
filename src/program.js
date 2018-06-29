"use strict";

(function() {

    const core = require('mlproj-core');
    const node = require('./node');

    function makeProgram() {

        let prg = new Program();

        prg
            .option('code',     '-c', '--code',      'set/override the @code')
            .flag(  'dry',      '-d', '--dry', '--dry-run', 'dry run')
            .option('host',     '-h', '--host',      'set/override the @host')
            .map(   'param',    '-p', '--param',     'set/override a parameter value <name:value>')
            .flag(  'trace',    '-T', '--trace',     'enable HTTP traces')
            .option('tracedir', '-t', '--trace-dir', 'the dir to put HTTP traces (enable as well)')
            .option('user',     '-u', '--user',      'set/override the @user')
            .flag(  'verbose',  '-v', '--verbose',   'verbose mode')
            .or()
                .flag(  'ipassword', '-z', '--ipassword', 'ask for password interactively')
                .option('password',  '-Z', '--password',  'set/override the @password')
                .end()
            .or()
                .option('environ', '-e', '--environ', 'environment name')
                .option('file',    '-f', '--file',    'environment file')
                .end();

        prg
            .command('help')
            .desc('Display help about another command.')
            .usage('[cmd]')
            .arg('cmd');

        prg
            .command('new')
            .clazz(core.NewCommand)
            .desc('Create a new project in the current directory.')
            .usage('[-f]')
            .flag('force', '-f', '--force', 'force overwriting files');

        prg
            .command('show')
            .clazz(core.ShowCommand)
            .desc('Display the environment.')
            .usage('');

        prg
            .command('init')
            .clazz(core.InitCommand)
            .desc('Initialize a new MarkLogic instance or cluster.')
            .usage('[-k key] [-l licensee] [-m master] [kind hosts...]')
            .option('key',      '-k', '--key',      'license key')
            .option('licensee', '-l', '--licensee', 'authorized licensee of the license key')
            .option('master',   '-m', '--master',   'master host (with optional port)')
            .arg('kind')
            .rest('hosts');

        prg
            .command('setup')
            .clazz(core.SetupCommand)
            .desc('Setup the environment on MarkLogic.')
            .usage('[what]')
            .arg('what');

        prg
            .command('load')
            .clazz(core.LoadCommand)
            .desc('Load documents to a database.')
            .usage('[-a srv|-b db] [-s src|-/ dir|-1 file] [what]')
            .or()
                .option('server',   '-a', '--as',  '--server',          'server, get its content database')
                .option('database', '-b', '--db',  '--database',        'target database')
                .option('systemDb', '-B', '--sys', '--system-database', 'the name of the target system db')
                .end()
            .or()
                .option('sourceset', '-s', '--src', '--source-set', 'source set to load')
                .option('directory', '-/', '--dir', '--directory',  'directory to load')
                .option('document',  '-1', '--doc', '--document',   'file to load')
                .arg('what')
                .end();

        prg
            .command('deploy')
            .clazz(core.DeployCommand)
            .desc('Deploy modules to a database.')
            .usage('[-a srv|-b db] [-s src|-/ dir|-1 file] [what]')
            .or()
                .option('server',   '-a', '--as',  '--server',          'server, get its modules database')
                .option('database', '-b', '--db',  '--database',        'target database')
                .option('systemDb', '-B', '--sys', '--system-database', 'the name of the target system db')
                .end()
            .or()
                .option('sourceset', '-s', '--src', '--source-set', 'source set to deploy')
                .option('directory', '-/', '--dir', '--directory',  'directory to deploy')
                .option('document',  '-1', '--doc', '--document',   'file to deploy')
                .arg('what')
                .end();

        prg
            .command('watch')
            .clazz(node.WatchCommand)
            .desc('Watch modules, deploy them as soon as modified.')
            .usage('[-a srv|-b db] [-s src|-/ dir|-1 file] [what]')
            .or()
                .option('server',   '-a', '--as',  '--server',          'server, get its modules database')
                .option('database', '-b', '--db',  '--database',        'target database')
                .option('systemDb', '-B', '--sys', '--system-database', 'the name of the target system db')
                .end()
            .or()
                .option('sourceset', '-s', '--src', '--source-set', 'source set to deploy')
                .option('directory', '-/', '--dir', '--directory',  'directory to deploy')
                .option('document',  '-1', '--doc', '--document',   'file to deploy')
                .arg('what')
                .end();

        prg
            .command('run')
            .clazz(core.RunCommand)
            .desc('Run a user command.')
            .usage('cmd')
            .arg('cmd');

        // help
        prg.help('help',
`Options:

       <cmd>         the name of the command to display the help of

   Display help about another command.  Just give the command name as a
   parameter.  With no parameter, display the global help message.

   Example:

       mlproj help deploy`);

        // new
        prg.help('new',
`Options:

       -f, --force         force overriding existing files

   The command asks interactively questions about the project to create.  If
   the current directory is not empty, asks confirmatino before going any
   further.  Trying to write a file that already exists results in an error,
   except if the flag --force has been set.`);

        // show
        prg.help('show',
`Display the details of the given environment.  The environment is "resolved"
   before being displayed (variables, dependencies are resolved, parameters
   are injected.)`);

        // init
        prg.help('init',
`Options:

       -k, --key <key>        license key
       -l, --licensee <name>  authorized licensee of the license key
       -m, --master           master hostname (format "host[:port]")
       <kind>                 thing to init: host, master, extra or cluster
       <hosts...>             the hostname(s) of the thing(s) to initialize

   The initialization sequence is essentialy: "init master" to initialize the
   first node, then "init extra" once for each extra node in the cluster.
   "init cluster" initializes all nodes at once.

   To initialize a single-node, standalone instance, use "init host" (which
   is technically the same as "init master", or as "init cluster" with no
   extra node.)

   If your environ files are correctly configured, you are able to initialize
   the entire cluster (or single node) by simply invoking "mlproj init".  See
   the reference documentation for the init command and for environ files for
   all details and more examples.

   The key and licensee name are the license information to use for the master
   (or single host.)  When initializing an extra node, you might need to pass
   the master connection info, using --master.

   Note that there is no real "master" in a cluster (MarkLogic documentation
   rather uses the term "bootstrap node".)  See the official MarkLogic doc for
   details.

   Examples:

   The following initializes the host(s) as configured in the environ "prod":

       mlproj -e prod init

   The following adds a new host to a cluster, using the main host in the
   default environ as the master:

       mlproj init extra some-hostname

   The following initializes the master using the main host in the environ,
   passing license key and licensee name on the command line, and adds two
   extra nodes to the cluster:

       mlproj init -k 87365473 -l "My company" cluster host-one host-two`);

        // setup
        prg.help('setup',
`Options:

       <what>              the specific component(s) to set up

   Create components in the given environment on MarkLogic.  Use the connection
   details from the environment to connect to MarkLogic.  If (some) components
   already exist, ensure they have the right properties and update them as
   needed.`);

        // load
        prg.help('load',
`Options:

       -a, --as, --server <srv>           server, get its content database
       -b, --db, --database <db>          target database
       -B, --sys, --system-database <db>  the name of the target system db
       -s, --src, --source-set <dir>      source set to load
       -/, --dir, --directory <dir>       directory to load
       -1, --doc, --document <file>       file to load
       <what>                             directory or file to load

   Target:

   The file(s) are loaded to a database.  It can be set explicitely with --db.
   The option --as gives the name of an application server.  Its content
   database if used.  If no explicit target, if there is a single one server,
   use it.  Or if there is only one database, use it.  Servers and databases
   can be referenced by name or by ID.

   Options --as, --db and --sys are mutually exclusive.

   Content:

   The content to load is given either with --src (the name of a source set), or
   with with --dir (points to a directory), or with --doc (points to a file).
   If none is given and <what> is used instead, it must be the name of an
   existing source set, or point to an existing directory.  If <what> is not
   given either, its default value is "data".

   Options --src, --dir and --doc, and argument <what> are mutually exclusive.

   Examples:

   The following loads files under "data/" to the "content" db:

       mlproj load --db content --dir data/

   Which does the same as the following command (assuming there is exactly
   one application server in the environment, with its content database being
   "content", and there is a source set with name "data" and dir "data/"):

       mlproj load`);

        // deploy
        prg.help('deploy',
`Options:

       -a, --as, --server <srv>           server, get its modules database
       -b, --db, --database <db>          target database
       -B, --sys, --system-database <db>  the name of the target system db
       -s, --src, --source-set <dir>      source set to deploy
       -/, --dir, --directory <dir>       directory to deploy
       -1, --doc, --document <file>       file to deploy
       <what>                             directory or file to deploy

   Works like the command load, with two exceptions: the default value of
   <what> is "src" instead of "data", and when given a server, it takes its
   modules database instead of its content database.

   Examples:

   The following deploys files under "src/" to the "modules" db:

       mlproj deploy --db modules --dir src/

   Which does the same as the following command (assuming there is exactly
   one application server in the environment, with its modules database being
   "modules", and there is a source set with name "src" and dir "src/"):

       mlproj deploy`);

        // watch
        prg.help('watch',
`Options:

       -a, --as, --server <srv>           server, get its modules database
       -b, --db, --database <db>          target database
       -B, --sys, --system-database <db>  the name of the target system db
       -s, --src, --source-set <dir>      source set to watch
       -/, --dir, --directory <dir>       directory to watch
       -1, --doc, --document <file>       file to watch
       <what>                             directory or file to watch

   Works like the command deploy, except it watches the given file or directory
   for changes, and deploy them each when they change on the filesystem.`);

        // setup
        prg.help('run',
`Options:

       <cmd>               the name of the user command to run

   Run a user command, given by name.  The user command must exist in the
   environment.`);

        return prg;
    }

    function _addArgument(prg, clazz, args) {
        let name = args.shift();
        let desc = args.pop();
        let arg  = new clazz(name, args, desc);
        args.forEach(f => {
            if ( prg.args[f] ) {
                throw new Error('Flag ' + f + ' already given');
            }
            prg.args[f] = arg;
        });
        if ( prg.keys[name] ) {
            throw new Error('Argument ' + name + ' already given');
        }
        prg.keys[name] = arg;
        return arg;
    }

    class Argument
    {
        constructor(name, flags, desc) {
            this.name  = name;
            this.flags = flags;
            this.desc  = desc;
        }

        // check the exclusive group
        found(res, arg, args) {
            if ( this.group ) {
                this.group.args.forEach(a => {
                    if ( res[a.name] ) {
                        throw new Error('Arg ' + a.name + ' already set, exclusive with: ' + this.name);
                    }
                });
            }
        }
    }

    class Flag extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( res[this.name] ) {
                throw new Error('Option ' + arg + ' already given using ' + res[this.name]);
            }
            res[this.name] = arg;
        }
    }

    class Map extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( ! args.length ) {
                throw new Error('No value for option ' + arg);
            }
            let item = args.shift();
            var idx  = item.indexOf(':');
            if ( idx < 0 ) {
                idx = item.indexOf('=');
            }
            if ( idx < 0 ) {
                throw new Error('Invalid param, must use : or = between name and value');
            }
            var name  = item.slice(0, idx);
            var value = item.slice(idx + 1);
            if ( ! res[this.name] ) {
                res[this.name] = {};
            }
            if ( res[this.name][name] ) {
                throw new Error('Entry ' + name + ' of option ' + arg + ' already given using ' + res[this.name][name]);
            }
            res[this.name][name] = value;
        }
    }

    class Option extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( ! args.length ) {
                throw new Error('No value for option ' + arg);
            }
            if ( res[this.name] ) {
                throw new Error('Option ' + arg + ' already given value: ' + res[this.name]);
            }
            res[this.name] = args.shift();
        }
    }

    class Arg extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            const n = this.name;
            if ( res[n] ) {
                throw new Error(`Argument with name ${n} already given: ${res[n]}`);
            }
            res[n] = arg;
        }
    }

    class Rest extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            const n = this.name;
            if ( ! res[n] ) {
                res[n] = [];
            }
            res[n].push(arg);
        }
    }

    class ArgumentGroup
    {
        constructor(prg) {
            // program, or command
            this.prg  = prg;
            this.keys = {};
            this.args = [];
        }

        arg(name) {
            if ( ! this.prg.extra ) {
                throw new Error(`Arguments not supported at program level: ${name}`);
            }
            let arg = _addArgument(this.prg, Arg, Array.from(arguments));
            arg.group = this;
            this.prg.extra.push(arg);
            this.args.push(arg);
            return this;
        }

        option() {
            let arg = _addArgument(this.prg, Option, Array.from(arguments));
            arg.flags.forEach(f => {
                this.keys[f] = arg;
            });
            arg.group = this;
            this.args.push(arg);
            return this;
        }

        flag() {
            let arg = _addArgument(this.prg, Flag, Array.from(arguments));
            arg.flags.forEach(f => {
                this.keys[f] = arg;
            });
            arg.group = this;
            this.args.push(arg);
            return this;
        }

        option() {
            let arg = _addArgument(this.prg, Option, Array.from(arguments));
            arg.flags.forEach(f => {
                this.keys[f] = arg;
            });
            arg.group = this;
            this.args.push(arg);
            return this;
        }

        end() {
            let prg = this.prg;
            this.prg = null;
            return prg;
        }
    }

    class Program
    {
        constructor() {
            this.args     = {};
            this.keys     = {};
            this.list     = [];
            this.commands = {};
        }

        flag() {
            let arg = _addArgument(this, Flag, Array.from(arguments));
            this.list.push(arg);
            return this;
        }

        map() {
            let arg = _addArgument(this, Map, Array.from(arguments));
            this.list.push(arg);
            return this;
        }

        option() {
            let arg = _addArgument(this, Option, Array.from(arguments));
            this.list.push(arg);
            return this;
        }

        or() {
            let arg = new ArgumentGroup(this);
            this.list.push(arg);
            return arg;
        }

        command(name) {
            let cmd = new Command(this, name);
            // TODO: Check does not exist yet...
            this.commands[name] = cmd;
            return cmd;
        }

        help(name, msg) {
            let cmd = this.commands[name];
            if ( ! cmd ) {
                throw new Error('Command does not exist: ' + name);
            }
            if ( cmd.help ) {
                throw new Error('Help already provided for command: ' + name);
            }
            cmd.help = msg;
        }

        parse(argv) {
            let args = Array.from(argv);
            let res  = {
                global : {},
                cmd    : null,
                local  : {}
            };
            let cmd;
            while ( args.length && ! cmd ) {
                let arg = args.shift();
                let opt = this.args[arg];
                if ( opt ) {
                    opt.found(res.global, arg, args);
                }
                else {
                    cmd = this.commands[arg];
                    if ( ! cmd ) {
                        throw new Error('No such option or command: ' + arg);
                    }
                    res.cmd = arg;
                }
            }
            while ( args.length ) {
                let arg = args.shift();
                let opt = cmd.args[arg];
                if ( opt ) {
                    opt.found(res.local, arg, args);
                }
                else if ( arg.startsWith('-') ) {
                    throw new Error(`No such command option: ${arg}`);
                }
                else {
                    if ( cmd.extra.length ) {
                        cmd.extra.shift().found(res.local, arg, args);
                    }
                    else if ( cmd.extras ) {
                        cmd.extras.found(res.local, arg, args);
                    }
                    else {
                        throw new Error(`No more argument supported: ${arg}`);
                    }
                }
            }
            return res;
        }
    }

    class Command
    {
        constructor(prg, name) {
            this.prg   = prg;
            this.name  = name;
            this.args  = {};
            this.extra = [];
            this.keys  = {};
            this.list  = [];
        }

        usage(u) {
            if ( ! arguments.length ) {
                return this._usage;
            }
            if ( this._usage ) {
                throw new Error('Usage already provided for command ' + this.name);
            }
            this._usage = u;
            return this;
        }

        desc(d) {
            if ( ! arguments.length ) {
                return this._desc;
            }
            if ( this._desc ) {
                throw new Error('Description already provided for command ' + this.name);
            }
            this._desc = d;
            return this;
        }

        clazz(c) {
            if ( ! arguments.length ) {
                return this._clazz;
            }
            if ( this._clazz ) {
                throw new Error('Class already provided for command ' + this.name);
            }
            this._clazz = c;
            return this;
        }

        flag() {
            let arg = _addArgument(this, Flag, Array.from(arguments));
            this.list.push(arg);
            return this;
        }

        option() {
            let arg = _addArgument(this, Option, Array.from(arguments));
            this.list.push(arg);
            return this;
        }

        arg() {
            let arg = _addArgument(this, Arg, Array.from(arguments));
            if ( this.extras ) {
                throw new Error(`Arg ${arg.name} cannot be set after a catch all Rest ${this.extras.name}`);
            }
            this.extra.push(arg);
            this.list.push(arg);
            return this;
        }

        rest() {
            let arg = _addArgument(this, Rest, Array.from(arguments));
            this.extras = arg;
            this.list.push(arg);
            return this;
        }

        or() {
            let arg = new ArgumentGroup(this);
            this.list.push(arg);
            return arg;
        }
    }

    module.exports = {
        Program     : Program,
        makeProgram : makeProgram
    }
}
)();
