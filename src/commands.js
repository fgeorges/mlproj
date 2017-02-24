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

	prepare(path, base, callback) {
            this.path  = path;
	    this.space = s.Space.load(this.platform, path, base);
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
	prepare(path, base, callback) {
	    super.prepare(path, base, callback);
	    callback();
	}

	execute(callback) {
	    var _ = this.platform;
	    _.log(_.green('Databases') + ':');
	    _.log(this.space.databases());
	    _.log(_.green('Database IDs') + ':');
	    _.log(Object.keys(this.space._dbIds));
	    _.log(_.green('Database names') + ':');
	    _.log(Object.keys(this.space._dbNames));
	    _.log(_.green('Servers') + ':');
	    _.log(this.space.servers());
	    _.log(_.green('Servers IDs') + ':');
	    _.log(Object.keys(this.space._srvIds));
	    _.log(_.green('Servers names') + ':');
	    _.log(Object.keys(this.space._srvNames));
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
	prepare(path, base, callback)
	{
	    super.prepare(path, base, callback);
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
