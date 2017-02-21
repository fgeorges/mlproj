"use strict";

(function() {

    const s = require('./space');

    /*~
     * A single one action.
     */
    class Action
    {
        constructor(url, data, msg)
        {
            this.url  = url;
            this.data = data;
            this.msg  = msg;
        }

        display(platform)
        {
            platform.log(this.msg);
        }

        execute(platform, space, verbose, error, success)
        {
            platform.warn(platform.green('post') + '  ' + this.msg);
            var url = 'http://' + space.param('@host') + ':8002/manage/v2' + this.url;
            if ( verbose ) {
                platform.warn('[' + platform.bold('verbose') + '] POST to ' + url);
                platform.warn('[' + platform.bold('verbose') + '] Body:');
                platform.warn(this.data);
            }
            var user = space.param('@user');
            var pwd  = space.param('@password');
	    platform.post(url, this.data, user, pwd, error, success);
        }
    }

    /*~
     * A list of actions.
     */
    class ActionList
    {
        constructor(platform, verbose)
        {
            this.platform = platform;
            this.verbose  = verbose;
            this.todo     = [];
            this.done     = [];
            this.error    = null;
        }

        add(a)
        {
            this.todo.push(a);
        }

        execute(space)
        {
            if ( ! this.todo.length ) {
                // nothing left to do
                this.display();
            }
            else {
                var action = this.todo.shift();
                action.execute(this.platform, space, this.verbose, msg => {
                    this.error = { action: action, message: msg };
                    // stop processing
                    this.display();
                }, () => {
                    this.done.push(action);
                    // TODO: Keep the idea of an event log?
                    // events.push('Database created: ' + db.name);
                    this.execute(space);
                });
            }
        }

        display()
        {
	    var _ = this.platform;
            _.log('--- ' + _.bold('Summary') + ' ---');
            if ( this.done.length ) {
                _.log(_.green('Done') + ':');
                this.done.forEach(a => a.display(_));
            }
            if ( this.error ) {
                _.log(_.red('Error') + ': ' + this.error.message);
                this.error.action.display(_);
            }
            if ( this.todo.length ) {
                _.log(_.yellow('Not done') + ':');
                this.todo.forEach(a => a.display(_));
            }
        }
    }

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

	prepare(path, base) {
            this.path  = path;
	    this.space = s.Space.load(this.platform, path, base);
	}

	execute() {
	    throw new Error('Command.execute is abstract');
	}
    }

    /*~
     * Display the resolved space.
     */
    class DebugCommand extends Command
    {
	execute() {
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
	}
    }

    /*~
     * Create the components from the space on MarkLogic.
     */
    class SetupCommand extends Command
    {
        prepare(path, base)
        {
	    super.prepare(path, base);
            this.actions = new ActionList(this.platform, this.verbose());
            // actions to create databases
            this.space.databases().forEach(db => {
                // the database itself
                this.actions.add(new Action(
                    '/databases',
                    db.api(),
                    'Create database: ' + db.name));
                // its forests
		// TODO: Supports numeric values for forests, and default of "1"
                if ( db.forests ) {
                    db.forests.forEach(f => {
                        this.actions.add(new Action(
                            '/forests',
                            { "forest-name": f, "database": db.name },
                            'Create forest: ' + f));
                    });
                }
            });
            // actions to create servers
            this.space.servers().forEach(srv => {
                this.actions.add(new Action(
                    // TODO: Support group-id other than Default...
                    '/servers?group-id=Default',
                    srv.api(),
                    'Create server: ' + srv.name));
            });
        }

        execute() {
            this.actions.execute(this.space);
        }
    }

    module.exports = {
        DebugCommand : DebugCommand,
        SetupCommand : SetupCommand
    }
}
)();
