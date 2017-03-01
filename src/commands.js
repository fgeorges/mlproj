"use strict";

(function() {

    const act = require('./action');
    const s   = require('./space');

    /*~
     * The base class/interface for commands.
     */
    class Command
    {
	constructor(platform) {
	    this.platform = platform;
            this._verbose = false;
	}


	verbose(v) {
	    if ( v === undefined ) {
		return this._verbose;
	    }
	    else {
		this._verbose = v;
	    }
	}

	prepare(env, path, base, callback) {
	    if ( env && path ) {
		throw new Error('Both `environ` and `path` set: ' + env + ', ' + path);
	    }
	    if ( ! env && ! path ) {
		throw new Error('None of `environ` and `path` set');
	    }
	    var actual = path ? path : 'xproject/ml/' + env + '.json';
            this.environ = env;
            this.path    = path;
	    this.space   = s.Space.load(this.platform, actual, base);
	    this.platform.space = this.space;
	}

	execute(callback) {
	    throw new Error('Command.execute is abstract');
	}

	summary() {
	    throw new Error('Command.summary is abstract');
	}
    }

    /*~
     * Display the resolved space.
     */
    class DebugCommand extends Command
    {
	prepare(env, path, base, callback) {
	    super.prepare(env, path, base, callback);
	    callback();
	}

	execute(callback) {
	    var pf = this.platform;
	    var components = comps => {
		comps.forEach(c => {
		    c.show(pf);
		    pf.log('');
		});
	    };
	    pf.log('');
	    this.showProject(pf);
	    components(this.space.databases());
	    components(this.space.servers());
	    callback();
	}

	showProject(pf) {
	    const imports = (space, level) => {
		space._imports.forEach(i => {
		    pf.line(level, '-> ' + i.href);
		    imports(i.space, level + 1);
		});
	    };
	    var mods;
	    try {
		mods = this.space.modulesDb().name;
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
	    pf.log('Project: ' + pf.bold(this.space.param('@code')));
	    [ 'title', 'desc', 'host', 'user', 'password' ].forEach(p => {
		var v = this.space.param('@' + p);
		v && pf.line(1, p, v);
	    });
	    pf.line(1, 'sources dir', this.space.param('@srcdir'));
	    mods && pf.line(1, 'modules DB', mods);
	    var params = this.space.params();
	    if ( params.length ) {
		pf.line(1, 'parameters:');
		params.forEach(p => pf.line(2, p, this.space.param(p)));
	    }
	    if ( this.space._imports.length ) {
		pf.line(1, 'import graph:');
		imports(this.space, 2);
	    }
	    pf.log('');
	}

	summary() {
	}
    }

    /*~
     * Create the components from the space on MarkLogic.
     */
    class SetupCommand extends Command
    {
	prepare(env, path, base, callback)
	{
	    super.prepare(env, path, base, callback);
	    this.platform.log('--- ' + this.platform.bold('Prepare') + ' ---');
	    // the action list
            this.actions = new act.ActionList(this.platform, this.verbose());
	    var impl = comps => {
		if ( comps.length ) {
		    comps[0].setup(this.actions, () => impl(comps.slice(1)));
		}
		else {
		    callback();
		}
	    };
	    var dbs  = this.space.databases();
	    var srvs = this.space.servers();
	    impl(dbs.concat(srvs));
        }

        execute(callback) {
	    var _ = this.platform;
	    _.log('\n--- ' + _.bold('Progress') + ' ---'
		  + (_.dry ? ' (' + _.red('dry run, not for real') + ')' : ''));
            this.actions.execute(callback);
        }

        summary() {
	    var _ = this.platform;
	    _.log('\n--- ' + _.bold('Summary') + ' ---'
		  + (_.dry ? ' (' + _.red('dry run, not for real') + ')' : ''));
            this.actions.summary();
        }
    }

    /*~
     * Deploy sources in a modules database.
     */
    class DeployCommand extends Command
    {
	prepare(env, path, base, callback) {
	    super.prepare(env, path, base, callback);
	    var db    = this.space.modulesDb();
	    var dir   = this.space.param('@srcdir');
	    var files = this.platform.allFiles(dir, f => {
		return f.name[f.name.length - 1] !== '~';
	    }, f => {
		// DEBUG: ...
		this.platform.log('Ignored file: ' + f.path);
	    });

            this.actions = new act.ActionList(this.platform, this.verbose());
	    files.forEach(f => {
		var uri = f.slice(dir.length - 1);
		var doc = this.platform.text(f);
		this.actions.add(new act.DocInsert(db, uri, doc));
	    });
	    callback();
	}

	execute(callback) {
            this.actions.execute(callback);
	}

	summary() {
	    // TODO: Display errors if any...
	    // And actions not done...
	}
    }

    module.exports = {
        DebugCommand  : DebugCommand,
        SetupCommand  : SetupCommand,
        DeployCommand : DeployCommand
    }
}
)();
