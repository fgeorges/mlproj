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
	    var _ = this.platform;
	    _.log(_.green('Databases') + ':');
	    _.log(this.space.databases());
	    _.log(_.green('Servers') + ':');
	    _.log(this.space.servers());
	    callback();
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
            this.actions.execute(this.space, callback);
        }

        summary() {
	    var _ = this.platform;
	    _.log('\n--- ' + _.bold('Summary') + ' ---'
		  + (_.dry ? ' (' + _.red('dry run, not for real') + ')' : ''));
            this.actions.summary();
        }
    }

    module.exports = {
        DebugCommand : DebugCommand,
        SetupCommand : SetupCommand
    }
}
)();
