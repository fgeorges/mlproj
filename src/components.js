"use strict";

(function() {

    const act   = require('./action');
    const props = require('./properties');

    function logCheck(actions, indent, msg, arg) {
        var p = actions.platform;
        var s = '';
        while ( indent-- ) {
            s += '   ';
        }
        p.log(s + '• ' + p.yellow('checking') + ' ' + msg + (arg ? ': \t' + arg : ''));
    }

    function logAdd(actions, indent, verb, msg, arg) {
        var p = actions.platform;
        var s = '';
        while ( indent-- ) {
            s += '   ';
        }
        p.log(s + '  need to ' + p.green(verb) + ' ' + msg + (arg ? ': \t' + arg : ''));
    }

    function logRemove(actions, indent, verb, msg, arg) {
        var p = actions.platform;
        var s = '';
        while ( indent-- ) {
            s += '   ';
        }
        p.log(s + '  need to ' + p.red(verb) + ' ' + msg + (arg ? ': \t' + arg : ''));
    }

    /*~
     * Interface of a component.
     */
    class Component
    {
        show(platform) {
            throw new Error('Component.show is abstract');
        }
        setup(actions, callback) {
            throw new Error('Component.setup is abstract');
        }
        create(actions, callback) {
            throw new Error('Component.create is abstract');
        }
        remove(actions, callback) {
            throw new Error('Component.remove is abstract');
        }
    }

    /*~
     * A system database.
     */
    class SysDatabase extends Component
    {
        constructor(name)
        {
            super();
            this.name = name;
        }
    }

    /*~
     * A database.
     */
    class Database extends Component
    {
        constructor(json, schema, security, triggers)
        {
            super();
            this.id       = json.id;
            this.name     = json.name;
            this.schema   = schema   === 'self' ? this : schema;
            this.security = security === 'self' ? this : security;
            this.triggers = triggers === 'self' ? this : triggers;
            this.forests  = {};
            // extract the configured properties
            this.props    = props.database.parse(json);
            // the forests
            var forests = json.forests;
            if ( forests === null || forests === undefined ) {
                forests = 1;
            }
            if ( Number.isInteger(forests) ) {
                if ( forests < 0 ) {
                    throw new Error('Negative number of forests (' + forests + ') on id:'
                                    + json.id + '|name:' + json.name);
                }
                if ( forests > 100 ) {
                    throw new Error('Number of forests greater than 100 (' + forests + ') on id:'
                                    + json.id + '|name:' + json.name);
                }
                var array = [];
                for ( var i = 1; i <= forests; ++i ) {
                    var num = i.toLocaleString('en-IN', { minimumIntegerDigits: 3 });
                    array.push(json.name + '-' + num);
                }
                forests = array;
            }
            forests.forEach(f => {
                this.forests[f] = new Forest(this, f);
            });
        }

        show(pf)
        {
            pf.log(pf.bold('Database') + ': ' + pf.bold(pf.yellow(this.name)));
            this.id       && pf.line(1, 'id',          this.id);
            this.schema   && pf.line(1, 'schema DB',   this.schema.name);
            this.security && pf.line(1, 'security DB', this.security.name);
            this.triggers && pf.line(1, 'triggers DB', this.triggers.name);
            var forests = Object.keys(this.forests);
            if ( forests.length ) {
                pf.line(1, 'forests:');
                forests.sort().forEach(f => pf.line(2, f));
            }
            Object.keys(this.props).forEach(p => this.props[p].show(pf));
        }

        setup(actions, callback)
        {
            logCheck(actions, 0, 'the database', this.name);
            new act.DatabaseProps(this).execute(
                actions.platform,
                msg => {
                    // TODO: Integrate more nicely in the reporting...
                    throw new Error('Error during GET DB ' + this.name + ': ' + msg);
                },
                body => {
                    new act.ForestList().execute(
                        actions.platform,
                        msg => {
                            // TODO: Integrate more nicely in the reporting...
                            throw new Error('Error during GET forests: ' + msg);
                        },
                        forests => {
                            var items = forests['forest-default-list']['list-items']['list-item'];
                            var names = items.map(o => o.nameref);
                            // if DB does not exist yet
                            if ( ! body ) {
                                this.create(actions, callback, names);
                            }
                            // if DB already exists
                            else {
                                this.update(actions, callback, body, names);
                            }
                        });
                });
        }

        create(actions, callback, forests)
        {
            logAdd(actions, 0, 'create', 'database', this.name);
            // the base database object
            var obj = {
                "database-name": this.name
            };
            // its schema, security and triggers DB
            this.schema   && ( obj['schema-database']   = this.schema.name   );
            this.security && ( obj['security-database'] = this.security.name );
            this.triggers && ( obj['triggers-database'] = this.triggers.name );
            // its properties
            Object.keys(this.props).forEach(p => {
                this.props[p].create(obj);
            });
            // enqueue the "create db" action
            actions.add(new act.DatabaseCreate(this, obj));
            logCheck(actions, 1, 'forests');
            // check the forests
            Object.keys(this.forests).forEach(f => this.forests[f].create(actions, forests));
            callback();
        }

        update(actions, callback, body, forests)
        {
            // check databases
            this.updateDb(actions, this.schema,   body, 'schema-database',   'Schemas');
            this.updateDb(actions, this.security, body, 'security-database', 'Security');
            this.updateDb(actions, this.triggers, body, 'triggers-database', null);

            // check forests
            logCheck(actions, 1, 'forests');
            var actual  = body.forest || [];
            var desired = Object.keys(this.forests);
            // forests to remove: those in `actual` but not in `desired`
            actual
                .filter(name => ! desired.includes(name))
                .forEach(name => {
                    new Forest(this, name).remove(actions);
                });
            // forests to add: those in `desired` but not in `actual`
            desired
                .filter(name => ! actual.includes(name))
                .forEach(name => {
                    this.forests[name].create(actions, forests);
                });

            // check properties
            logCheck(actions, 1, 'properties');
            Object.keys(this.props).forEach(p => {
                this.props[p].update(actions, body, this, logAdd);
            });

            callback();
        }

        updateDb(actions, db, body, prop, dflt)
        {
            var actual = body[prop];
            var newName;

            // do not exist, not desired
            if ( ! actual && ! db || (actual === dflt && ! db) ) {
                // nothing
            }
            // does exist, to remove
            else if ( ! db ) {
                newName = dflt || null;
            }
            // do not exist, to create, or does exist, to chamge
            else if ( ! actual || (actual !== db.name) ) {
                newName = db.name;
            }
            // already set to the right db
            else {
                // nothing
            }

            // enqueue the action if necessary
            if ( newName !== undefined ) {
                logAdd(actions, 0, 'update', prop);
                actions.add(new act.DatabaseUpdate(this, prop, newName));
            }
        }
    }

    /*~
     * A forest.
     */
    class Forest extends Component
    {
        constructor(db, name)
        {
            super();
            this.db   = db;
            this.name = name;
        }

        create(actions, forests)
        {
            // if already exists, attach it instead of creating it
            if ( forests.includes(this.name) ) {
                logAdd(actions, 1, 'attach', 'forest', this.name);
                actions.add(new act.ForestAttach(this));
            }
            else {
                logAdd(actions, 1, 'create', 'forest', this.name);
                actions.add(new act.ForestCreate(this));
            }
        }

        remove(actions)
        {
            logRemove(actions, 1, 'detach', 'forest', this.name);
            // just detach it, not delete it for real
            actions.add(new act.ForestDetach(this));
        }
    }

    /*~
     * A server.
     */
    class Server extends Component
    {
        constructor(json, space, content, modules)
        {
            super();
            this.group   = json.group || 'Default';
            this.id      = json.id;
            this.name    = json.name;
            this.content = content;
            this.modules = modules;
            // extract the configured properties
            this.props   = props.server.parse(json, this.props);
            // use @srcdir if no modules DB and no root
            if ( ! this.modules && ! this.props.root ) {
                var dir = space.param('@srcdir');
                if ( ! dir ) {
                    throw new Error('No @srcdir for the root of the server: ' + this.name);
                }
                this.props.root = new props.Result(props.server.props.root, dir);
            }
        }

        show(pf)
        {
            pf.log(pf.bold('Server') + ': ' + pf.bold(pf.yellow(this.name)));
            pf.line(1, 'group', this.group);
            this.id      && pf.line(1, 'id',         this.id);
            this.content && pf.line(1, 'content DB', this.content.name);
            this.modules && pf.line(1, 'modules DB', this.modules.name);
            // explicit list of properties, to guarantee the order they are displayed
            [ 'type', 'port', 'root', 'rewriter', 'handler' ].forEach(p => {
                if ( this.props[p] !== undefined ) {
                    this.props[p].show(pf);
                }
            });
        }

        setup(actions, callback)
        {
            logCheck(actions, 0, 'the ' + this.props['server-type'].value + ' server', this.name);
            new act.ServerProps(this).execute(
                actions.platform,
                msg => {
                    // TODO: Integrate more nicely in the reporting...
                    throw new Error('Error during GET AS ' + this.name + ': ' + msg);
                },
                body => {
                    // if AS does not exist yet
                    if ( ! body ) {
                        this.create(actions, callback);
                    }
                    // if AS already exists
                    else {
                        this.update(actions, callback, body);
                    }
                });
        }

        create(actions, callback)
        {
            logAdd(actions, 0, 'create', 'server', this.name);
            var obj = {
                "server-name":      this.name,
                "content-database": this.content.name
            };
            this.modules && ( obj['modules-database'] = this.modules.name );
            Object.keys(this.props).forEach(p => {
                this.props[p].create(obj);
            });
            actions.add(new act.ServerCreate(this, obj));
            callback();
        }

        update(actions, callback, actual)
        {
            // the content and modules databases
            if ( this.content.name !== actual['content-database'] ) {
                logAdd(actions, 0, 'update', 'content-database');
                actions.add(new act.ServerUpdate(this, 'content-database', this.content.name));
            }
            if ( ( ! this.modules && actual['modules-database'] )
                 || ( this.modules && ! actual['modules-database'] )
                 || ( this.modules && this.modules.name !== actual['modules-database'] ) ) {
                var mods = this.modules ? this.modules.name : null;
                logAdd(actions, 0, 'update', 'modules-database');
                actions.add(new act.ServerUpdate(this, 'modules-database', mods));
            }

            // check properties
            logCheck(actions, 1, 'properties');
            Object.keys(this.props).forEach(p => {
                this.props[p].update(actions, actual, this, logAdd);
            });

            callback();
        }
    }

    module.exports = {
        SysDatabase : SysDatabase,
        Database    : Database,
        Server      : Server
    }
}
)();
