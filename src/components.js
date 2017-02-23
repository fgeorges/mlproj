"use strict";

(function() {

    const act = require('./action');

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
     * A database.
     */
    class Database extends Component
    {
        constructor(db)
        {
	    super();
            this.id      = db.id;
            this.name    = db.name;
            this.forests = {};
            this.indexes = new Indexes(this, db.indexes);
	    var forests = db.forests;
	    if ( forests === null || forests === undefined ) {
		forests = 1;
	    }
	    if ( Number.isInteger(forests) ) {
		if ( forests < 0 ) {
		    throw new Error('Negative number of forests (' + forests + ') on id:'
				    + db.id + '|name:' + db.name);
		}
		if ( forests > 100 ) {
		    throw new Error('Number of forests greater than 100 (' + forests + ') on id:'
				    + db.id + '|name:' + db.name);
		}
		var array = [];
		for ( var i = 1; i <= forests; ++i ) {
		    array.push(db.name + '-' + i.toLocaleString('en-IN', { minimumIntegerDigits: 3 }));
		}
		forests = array;
	    }
	    forests.forEach(f => {
		this.forests[f] = new Forest(this, f);
	    });
        }

        setup(actions, callback)
        {
	    logCheck(actions, 0, 'database', this.name);
	    actions.platform.get('/databases/' + this.name + '/properties', msg => {
		// TODO: Integrate more nicely in the reporting...
		throw new Error('Error during GET DB: ' + this.name);
            }, (body) => {
		actions.platform.get('/forests', msg => {
		    // TODO: Integrate more nicely in the reporting...
		    throw new Error('Error during GET forests');
		}, (forests) => {
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
	    var obj = {
		"database-name": this.name
	    };
	    this.indexes.create(obj);
	    actions.add(new act.Post(
		'/databases',
		obj,
		'Create database: \t' + this.name));
	    logCheck(actions, 1, 'forests');
	    Object.values(this.forests).forEach(f => f.create(actions, forests));
	    callback();
	}

        update(actions, callback, body, forests)
        {
	    // check forests...
	    logCheck(actions, 1, 'forests');
	    var actual  = body.forest || [];
	    var desired = Object.keys(this.forests);
	    // to remove: those in `actual` but not in `desired`
	    actual
		.filter(name => ! desired.includes(name))
		.forEach(name => {
		    new Forest(this, name).remove(actions);
		});
	    // to add: those in `desired` but not in `actual`
	    desired
		.filter(name => ! actual.includes(name))
		.forEach(name => {
		    this.forests[name].create(actions, forests);
		});

	    // check indexes...
	    logCheck(actions, 1, 'indexes');
	    var elemRanges = {};
	    var ranges     = body['range-element-index'] || [];
	    ranges.forEach(idx => {
		var names = idx.localname;
		if ( ! Array.isArray(names) ) {
		    names = [ idx.localname ];
		}
		while ( names.length ) {
		    var ns  = idx['namespace-uri'];
		    var key = ( ns ? '{' + ns + '}' : '' ) + names.shift();
		    elemRanges[key] = idx;
		}
	    });
	    this.indexes.update(actions, elemRanges);

	    // TODO: Check other properties...

	    callback();
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
		actions.add(new act.Post(
                    '/forests/' + this.name + '?state=attach&database=' + this.db.name,
                    null,
                    'Attach forest:  \t' + this.name));
	    }
	    else {
		logAdd(actions, 1, 'create', 'forest', this.name);
		actions.add(new act.Post(
                    '/forests',
                    { "forest-name": this.name, "database": this.db.name },
                    'Create forest:  \t' + this.name));
	    }
        }

        remove(actions)
        {
	    logRemove(actions, 1, 'detach', 'forest', this.name);
	    // just detach it, not delete it for real
            actions.add(new act.Post(
                '/forests/' + this.name + '?state=detach',
                null,
                'Detach forest:  \t' + this.name));
        }
    }

    /*~
     * A server.
     */
    class Server extends Component
    {
        constructor(srv)
        {
	    super();
            this.id      = srv.id;
            this.name    = srv.name;
            this.type    = srv.type;
            this.port    = srv.port;
            this.root    = srv.root;
            this.content = srv.content;
            this.modules = srv.modules;
        }

        setup(actions, callback)
	{
	    // TODO: More than that... (what if it already exists...?)
	    this.create(actions, callback);
	}

        create(actions, callback)
	{
            var obj = {
                "server-name":      this.name,
                "server-type":      this.type,
                "port":             this.port,
                "root":             this.root,
                "content-database": this.content.name
            };
            if ( this.modules && this.modules.name ) {
                obj['modules-database'] = this.modules.name;
            }
            actions.add(new act.Post(
                // TODO: Support group-id other than Default...
                '/servers?group-id=Default',
                obj,
                'Create server:  \t' + this.name));
	    callback();
	}
    }

    /*~
     * All the indexes of a database.
     */
    class Indexes
    {
        constructor(db, indexes)
        {
	    this.db        = db;
            this.rangeElem = {};
            // this.rangeAttr = {};
            // ...
            if ( indexes ) {
		var keys = Object.keys(indexes);
		if ( indexes.ranges ) {
		    keys.splice(keys.indexOf('ranges'), 1);
                    indexes.ranges.forEach(idx => {
		        if ( idx.parent ) {
			    // this.rangeAttr.push(new AttributeRangeIndex(idx));
			    throw new Error('Attribute range index not supported yet');
			}
			else {
			    var names = idx.name;
			    if ( ! Array.isArray(names) ) {
				names = [ idx.name ];
			    }
			    while ( names.length ) {
				idx.name = names.shift();
				var ns  = idx.namespace;
				var key = ( ns ? '{' + ns + '}' : '' ) + idx.name;
				this.rangeElem[key] = new ElementRangeIndex(idx);
			    }
			}
		    });
		}
		if ( keys.length ) {
		    throw new Error('Unknown index type(s): ' + keys);
		}
            }
        }

	update(actions, ranges)
	{
	    var actual  = Object.keys(ranges);
	    var desired = Object.keys(this.rangeElem);
	    // to keep: those in both `actual` and `desired`
	    // check they are what's desired, or fail
	    var keep = actual.filter(name => desired.includes(name));
	    keep.forEach(name => {
		this.rangeElem[name].update(actions, name, ranges[name]);
	    });
	    // if there is any change...
	    if ( keep.length !== actual.length || keep.length !== desired.length ) {
		logAdd(actions, 1, 'update', 'element range indexes');
		// reconstruct the whole `range-element-index` property array
		var body = {};
		this.create(body);
		actions.add(new act.Put(
                    '/databases/' + this.db.name + '/properties',
                    body,
                    'Update indexes:  \t' + this.db.name));
	    }
	}

        create(db)
        {
	    // if there is no index, that will be an empty array, preventing the
	    // default DLS range indexes to be created
            db['range-element-index'] =
		Object.values(this.rangeElem)
		.map(idx => idx.create());
        }
    }

    /*~
     * One range index.
     */
    class ElementRangeIndex
    {
        constructor(idx)
        {
            this.type      = idx.type;
            this.name      = idx.name;
            this.positions = idx.positions;
            this.invalid   = idx.invalid;
            this.namespace = idx.namespace ? idx.namespace : '';
            this.collation = idx.collation ? idx.collation : 'http://marklogic.com/collation/';
        }

        create()
        {
            var obj = {
                "scalar-type":           this.type,
                "localname":             this.name,
                "range-value-positions": this.positions,
                "invalid-values":        this.invalid,
                "namespace-uri":         this.namespace,
                "collation":             this.collation
            };
            return obj;
        }

	update(actions, name, actual)
	{
	    var diffs = [];
            if ( this.type !== actual['scalar-type'] ) {
		diffs.push('type');
	    }
            if ( this.name !== actual['localname'] ) {
		diffs.push('name');
	    }
            if ( this.positions !== actual['range-value-positions'] ) {
		diffs.push('positions');
	    }
	    // TODO: Don't we want to allow some changes, e.g. the value of
	    // `invalid-values`?  What changes does the Management API allow?
            if ( this.invalid !== actual['invalid-values'] ) {
		diffs.push('invalid');
	    }
            if ( this.namespace !== actual['namespace-uri'] ) {
		diffs.push('namespace');
	    }
            if ( this.collation !== actual['collation'] ) {
		diffs.push('collation');
	    }
	    if ( diffs.length ) {
		var msg = 'Range index for element `' + name + '` differ by `' + diffs[0] + '`';
		for ( var i = 1; i < diffs.length - 1; ++i ) {
		    msg += ', `' + diffs[i] + '`';
		}
		if ( diffs.length > 1 ) {
		    msg += ' and `' + diffs[diffs.length - 1] + '`';
		}
		// TODO: Instead of stopping here, we should accumulate such
		// errors in `actions` and keep going.  In `ActionList.execute`,
		// we can then check if there is any error before going further.
		// This way, we could accumulate all errors instead of stopping
		// on the first one, for reporting purposes.  Applies to other
		// places as well.
		throw new Error(msg);
	    }
	}
    }

    module.exports = {
        Database : Database,
        Server   : Server
    }
}
)();
