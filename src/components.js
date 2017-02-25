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
        constructor(json, schemas, security)
        {
	    super();
            this.id       = json.id;
            this.name     = json.name;
            this.schemas  = schemas;
            this.security = security;
            this.forests  = {};
            this.indexes  = new Indexes(this, json.indexes);
            this.lexicons = new Lexicons(this, json.lexicons);
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

        setup(actions, callback)
        {
	    logCheck(actions, 0, 'database', this.name);
	    actions.platform.get('/databases/' + this.name + '/properties', msg => {
		// TODO: Integrate more nicely in the reporting...
		throw new Error('Error during GET DB ' + this.name + ': ' + msg);
            }, (body) => {
		actions.platform.get('/forests', msg => {
		    // TODO: Integrate more nicely in the reporting...
		    throw new Error('Error during GET forests: ' + msg);
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
	    this.lexicons.create(obj);
	    actions.add(new act.Post(
		'/databases',
		obj,
		'Create database: \t\t' + this.name));
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
	    this.indexes.update(actions, body);

	    // check lexicons...
	    logCheck(actions, 1, 'lexicons');
	    this.lexicons.update(actions, body);

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
                    'Attach forest:  \t\t' + this.name));
	    }
	    else {
		logAdd(actions, 1, 'create', 'forest', this.name);
		actions.add(new act.Post(
                    '/forests',
                    { "forest-name": this.name, "database": this.db.name },
                    'Create forest:  \t\t' + this.name));
	    }
        }

        remove(actions)
        {
	    logRemove(actions, 1, 'detach', 'forest', this.name);
	    // just detach it, not delete it for real
            actions.add(new act.Post(
                '/forests/' + this.name + '?state=detach',
                null,
                'Detach forest:  \t\t' + this.name));
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
            this.type    = json.type;
            this.port    = json.port;
            this.root    = json.root;
            this.content = content;
            this.modules = modules;
            if ( ! this.modules && ! this.root ) {
		var dir = space.param('@srcdir');
		if ( ! dir ) {
		    throw new Error('No @srcdir for the root of the server: ' + this.name);
		}
		this.root = dir;
	    }
        }

        setup(actions, callback)
	{
	    logCheck(actions, 0, 'server', this.name);
	    var url = '/servers/' + this.name + '/properties?group-id=' + this.group;
	    actions.platform.get(url, msg => {
		// TODO: Integrate more nicely in the reporting...
		throw new Error('Error during GET DB ' + this.name + ': ' + msg);
            }, (body) => {
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
                "server-type":      this.type,
                "port":             this.port,
                "root":             this.root,
                "content-database": this.content.name
            };
            if ( this.modules ) {
                obj['modules-database'] = this.modules.name;
            }
            actions.add(new act.Post(
                '/servers?group-id=' + this.group,
                obj,
                'Create server:  \t\t' + this.name));
	    callback();
	}

        update(actions, callback, actual)
	{
	    // TODO: Allow some changes, like port number...
	    var diffs = [];
            if ( this.type !== actual['server-type'] ) {
	    	diffs.push('type');
	    }
            if ( this.port !== actual['port'].toString() ) {
		diffs.push('port');
	    }
            if ( this.root !== actual['root'] ) {
	     	diffs.push('root: ' + this.root + ' - ' + actual['root']);
	    }
            if ( this.content.name !== actual['content-database'] ) {
		diffs.push('content');
	    }
            if ( ( ! this.modules && actual['modules-database'] )
		 || ( this.modules && ! actual['modules-database'] )
		 || ( this.modules && this.modules.name !== actual['modules-database'] ) ) {
		diffs.push('modules');
	    }
	    if ( diffs.length ) {
		var msg = 'Server differ by `' + diffs[0] + '`';
		for ( var i = 1; i < diffs.length - 1; ++i ) {
		    msg += ', `' + diffs[i] + '`';
		}
		if ( diffs.length > 1 ) {
		    msg += ' and `' + diffs[diffs.length - 1] + '`';
		}
		throw new Error(msg);
	    }
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
            this.rangeAttr = {};
            if ( indexes ) {
		var keys = Object.keys(indexes);
		if ( indexes.ranges ) {
		    keys.splice(keys.indexOf('ranges'), 1);
                    indexes.ranges.forEach(idx => {
		        if ( idx.parent ) {
			    AttributeRangeIndex.addToMap(this.rangeAttr, idx);
			}
			else {
			    ElementRangeIndex.addToMap(this.rangeElem, idx);
			}
		    });
		}
		if ( keys.length ) {
		    throw new Error('Unknown index type(s): ' + keys);
		}
            }
        }

	update(actions, body)
	{
	    // element range indexes
	    var elemRanges = {};
	    ( body['range-element-index'] || [] ).forEach(idx => {
		var name = idx['localname'];
		var ns   = idx['namespace-uri'];
		var key  = ElementRangeIndex.indexKey(name, ns);
		elemRanges[key] = idx;
	    });
	    ElementRangeIndex.update(actions, this.rangeElem, elemRanges, this.db);

	    // attribute range indexes
	    var attrRanges = {};
	    ( body['range-element-attribute-index'] || [] ).forEach(idx => {
		var name  = idx['localname'];
		var ns    = idx['namespace-uri'];
		var pName = idx['parent-localname'];
		var pNs   = idx['parent-namespace-uri'];
		var key   = ElementRangeIndex.indexKey(name, ns, pName, pNs);
		attrRanges[key] = idx;
	    });
	    AttributeRangeIndex.update(actions, this.rangeAttr, attrRanges, this.db);
	}

        create(db)
        {
	    ElementRangeIndex.create(db, this.rangeElem);
	    AttributeRangeIndex.create(db, this.rangeAttr);
        }
    }

    /*~
     * One element range index.
     */
    class ElementRangeIndex
    {
	static indexKey(name, ns, parentName, parentNs)
	{
	    var key = ( ns ? '{' + ns + '}' : '' ) + name;
	    if ( parentName ) {
		key += '|' + ( parentNs ? '{' + parentNs + '}' : '' ) + parentName;
	    }
	    return key;
	}

	static addToMapBase(map, json, ctor)
	{
	    var names = json.name;
	    if ( ! Array.isArray(names) ) {
		names = [ json.name ];
	    }
	    while ( names.length ) {
		json.name = names.shift();
		var p   = json.parent;
		var key = p
		    ? ElementRangeIndex.indexKey(json.name, json.namespace, p.name, p.namespace)
		    : ElementRangeIndex.indexKey(json.name, json.namespace);
		map[key] = ctor(json);
	    }
	}

	static addToMap(map, json)
	{
	    ElementRangeIndex.addToMapBase(map, json, idx => new ElementRangeIndex(idx));
	}

	static updateBase(actions, objects, json, db, enricher)
	{
	    var actual  = Object.keys(json);
	    var desired = Object.keys(objects);
	    // to keep: those in both `actual` and `desired`
	    // check they are what's desired, or fail
	    var keep = actual.filter(name => desired.includes(name));
	    keep.forEach(name => {
		objects[name].update(actions, name, json[name]);
	    });
	    // if there is any change...
	    if ( keep.length !== actual.length || keep.length !== desired.length ) {
		logAdd(actions, 1, 'update', 'element range indexes');
		// reconstruct the whole `range-element-index` property array
		var body = {};
		enricher(body, objects);
		actions.add(new act.Put(
                    '/databases/' + db.name + '/properties',
                    body,
                    'Update indexes:  \t\t' + db.name));
	    }
	}

	static update(actions, objects, json, db)
	{
	    ElementRangeIndex.updateBase(actions, objects, json, db, ElementRangeIndex.create);
	}

        static create(db, ranges)
        {
	    // if there is no index, that will be an empty array, preventing the
	    // default DLS range indexes to be created
            db['range-element-index'] =
		Object.values(ranges)
		.map(idx => idx.create());
        }

        constructor(json)
        {
            this.type      = json.type;
            this.name      = json.name;
            this.positions = json.positions;
            this.invalid   = json.invalid;
            this.namespace = json.namespace || '';
            this.collation = json.collation || 'http://marklogic.com/collation/';
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
	    this.updateDiffs(actions, name, actual, diffs);
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

	updateDiffs(actions, name, actual, diffs)
	{
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
	}
    }

    /*~
     * One attribute range index.
     */
    class AttributeRangeIndex extends ElementRangeIndex
    {
	static addToMap(map, json)
	{
	    ElementRangeIndex.addToMapBase(map, json, idx => new AttributeRangeIndex(idx));
	}

	static update(actions, objects, json, db)
	{
	    ElementRangeIndex.updateBase(actions, objects, json, db, AttributeRangeIndex.create);
	}

        static create(db, ranges)
        {
            db['range-element-attribute-index'] =
		Object.values(ranges)
		.map(idx => idx.create());
        }

        constructor(json)
        {
	    super(json);
            this.parentName = json.parent.name;
            this.parentNs   = json.parent.namespace || '';
        }

        create()
        {
            var obj = super.create();
	    obj['parent-localname']     = this.parentName;
	    obj['parent-namespace-uri'] = this.parentNs;
            return obj;
        }

	updateDiffs(actions, name, actual, diffs)
	{
	    super.updateDiffs(actions, name, actual, diffs);
            if ( this.parentName !== actual['parent-localname'] ) {
		diffs.push('parent/name');
	    }
            if ( this.parentNs !== actual['parent-namespace-uri'] ) {
		diffs.push('parent/namespace');
	    }
	}
    }

    /*~
     * All the lexicons of a database.
     */
    class Lexicons
    {
        constructor(db, lexicons)
        {
	    this.db   = db;
            this.uri  = lexicons && lexicons.uri;
            this.coll = lexicons && lexicons.collection;
        }

	update(actions, body)
	{
	    if ( ( this.uri !== undefined ) && ( this.uri !== body['uri-lexicon'] ) ) {
		logAdd(actions, 1, 'update', 'uri lexicon');
		actions.add(new act.Put(
                    '/databases/' + this.db.name + '/properties',
                    { "uri-lexicon": this.uri },
                    'Update URI lexicon: \t\t' + this.db.name));
	    }
	    if ( ( this.coll !== undefined ) && ( this.coll !== body['collection-lexicon'] ) ) {
		logAdd(actions, 1, 'update', 'collection lexicon');
		actions.add(new act.Put(
                    '/databases/' + this.db.name + '/properties',
                    { "collection-lexicon": this.coll },
                    'Update collection lexicon: \t' + this.db.name));
	    }
	}

        create(db)
        {
	    this.uri  && ( db['uri-lexicon']        = this.uri  );
	    this.coll && ( db['collection-lexicon'] = this.coll );
        }
    }

    module.exports = {
        Database : Database,
        Server   : Server
    }
}
)();
