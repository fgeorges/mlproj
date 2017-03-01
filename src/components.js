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

    function values(o) {
	const reduce = Function.bind.call(Function.call, Array.prototype.reduce);
	const isEnumerable = Function.bind.call(Function.call, Object.prototype.propertyIsEnumerable);
	const concat = Function.bind.call(Function.call, Array.prototype.concat);
	const keys = Reflect.ownKeys;
	return reduce(keys(o), (v, k) => {
	    return concat(v, typeof k === 'string' && isEnumerable(o, k) ? [o[k]] : []);
	}, []);
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
        constructor(json, schema, security, triggers)
        {
	    super();
            this.id       = json.id;
            this.name     = json.name;
            this.schema   = schema   === 'self' ? this : schema;
            this.security = security === 'self' ? this : security;
            this.triggers = triggers === 'self' ? this : triggers;
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
	    logCheck(actions, 0, 'the database', this.name);
	    new act.DatabaseProps(this).execute(
		actions.platform,
		actions.verbose,
		msg => {
		    // TODO: Integrate more nicely in the reporting...
		    throw new Error('Error during GET DB ' + this.name + ': ' + msg);
		},
		body => {
		    new act.ForestList().execute(
			actions.platform,
			actions.verbose,
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
	    // its indexes and lexicons
	    this.indexes.create(obj);
	    this.lexicons.create(obj);
	    // enqueue the "create db" action
	    actions.add(new act.DatabaseCreate(this, obj));
	    logCheck(actions, 1, 'forests');
	    // check the forests
	    values(this.forests).forEach(f => f.create(actions, forests));
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

	    // check indexes
	    logCheck(actions, 1, 'indexes');
	    this.indexes.update(actions, body);

	    // check lexicons
	    logCheck(actions, 1, 'lexicons');
	    this.lexicons.update(actions, body);

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
            this.group    = json.group || 'Default';
            this.id       = json.id;
            this.name     = json.name;
            this.type     = json.type;
            this.port     = json.port;
            this.root     = json.root;
            this.rewriter = json.rewriter;
            this.handler  = json.handler;
            this.content  = content;
            this.modules  = modules;
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
	    logCheck(actions, 0, 'the ' + this.type + ' server', this.name);
	    new act.ServerProps(this).execute(
		actions.platform,
		actions.verbose,
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
                "server-type":      this.type,
                "content-database": this.content.name
            };
            this.port     && ( obj['port']             = this.port         );
            this.root     && ( obj['root']             = this.root         );
            this.modules  && ( obj['modules-database'] = this.modules.name );
            this.rewriter && ( obj['url-rewriter']     = this.rewriter     );
            this.handler  && ( obj['error-handler']    = this.handler      );
	    actions.add(new act.ServerCreate(this, obj));
	    callback();
	}

        update(actions, callback, actual)
	{
	    // incompatible changes
	    var diffs = [];
            if ( this.type !== actual['server-type'] ) {
	    	diffs.push('type');
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

	    // TODO: Should be applicable, but not supported yet, because
	    // changing it restarts MarkLogic.
            if ( this.port !== actual['port'].toString() ) {
		throw new Error('Server differ by `root`, which is not supported to be changed yet');
	    }

	    // applicable changes
	    diffs = [];
            if ( this.root !== actual['root'] ) {
		diffs.push({ name: 'root', value: this.root });
	    }
            if ( this.content.name !== actual['content-database'] ) {
		diffs.push({ name: 'content-database', value: this.content.name });
	    }
            if ( ( ! this.modules && actual['modules-database'] )
		 || ( this.modules && ! actual['modules-database'] )
		 || ( this.modules && this.modules.name !== actual['modules-database'] ) ) {
		diffs.push({
		    name: 'modules-database',
		    value: this.modules ? this.modules.name : null
		});
	    }
            if ( this.rewriter !== actual['url-rewriter'] ) {
		diffs.push({ name: 'url-rewriter', value: this.rewriter });
	    }
            if ( this.handler !== actual['error-handler'] ) {
		diffs.push({ name: 'error-handler', value: this.handler });
	    }
	    diffs.forEach(diff => {
		logAdd(actions, 0, 'update', diff.name);
		actions.add(new act.ServerUpdate(this, diff.name, diff.value));
	    });
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
            this.rangePath = {};
            if ( indexes ) {
		var keys = Object.keys(indexes);
		if ( indexes.ranges ) {
		    keys.splice(keys.indexOf('ranges'), 1);
                    indexes.ranges.forEach(idx => {
		        if ( idx.path ) {
			    PathRangeIndex.addToMap(this.rangePath, idx);
			}
		        else if ( idx.parent ) {
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

	    // path range indexes
	    var pathRanges = {};
	    ( body['range-path-index'] || [] ).forEach(idx => {
		var key = idx['path-expression'];
		pathRanges[key] = idx;
	    });
	    PathRangeIndex.update(actions, this.rangePath, pathRanges, this.db);
	}

        create(db)
        {
	    ElementRangeIndex.create(db, this.rangeElem);
	    AttributeRangeIndex.create(db, this.rangeAttr);
	    PathRangeIndex.create(db, this.rangePath);
        }
    }

    /*~
     * Abstract class for one range index.
     */
    class RangeIndex
    {
	static indexKey(name, ns, parentName, parentNs)
	{
	    var key = ( ns ? '{' + ns + '}' : '' ) + name;
	    if ( parentName ) {
		key += '|' + ( parentNs ? '{' + parentNs + '}' : '' ) + parentName;
	    }
	    return key;
	}

	static addToMap(map, json, ctor)
	{
	    var names = json.name;
	    if ( ! Array.isArray(names) ) {
		names = [ json.name ];
	    }
	    while ( names.length ) {
		json.name = names.shift();
		var p   = json.parent;
		var key = json.path
		    ? json.path
		    : ( p
			? RangeIndex.indexKey(json.name, json.namespace, p.name, p.namespace)
			: RangeIndex.indexKey(json.name, json.namespace) );
		map[key] = ctor(json);
	    }
	}

	static update(actions, objects, json, db, prop, value, type)
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
		logAdd(actions, 1, 'update', type + ' range indexes');
		actions.add(new act.DatabaseUpdate(db, prop, value(objects)));
	    }
	}

        constructor(json)
        {
            this.type      = json.type;
            this.positions = json.positions;
            this.invalid   = json.invalid;
            this.collation = json.collation;
	    if ( this.type !== 'string' && this.collation ) {
		throw new Error('Range index with collation not of type string');
	    }
        }

        create()
        {
            var obj = {
                "scalar-type":           this.type,
                "range-value-positions": this.positions,
                "invalid-values":        this.invalid
            };
	    if ( this.type === 'string' ) {
		if ( this.collation ) {
		    obj.collation = this.collation;
		}
		else {
		    obj.collation = 'http://marklogic.com/collation/';
		}
	    }
            return obj;
        }

	update(actions, name, actual)
	{
	    var diffs = [];
	    this.updateDiffs(actions, name, actual, diffs);
	    if ( diffs.length ) {
		var msg = 'Range index for `' + name + '` differ by `' + diffs[0] + '`';
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
            if ( this.positions !== actual['range-value-positions'] ) {
		diffs.push('positions');
	    }
	    // TODO: Don't we want to allow some changes, e.g. the value of
	    // `invalid-values`?  What changes does the Management API allow?
            if ( this.invalid !== actual['invalid-values'] ) {
		diffs.push('invalid');
	    }
            if ( this.type === 'string' && this.collation !== actual['collation'] ) {
		diffs.push('collation');
	    }
	}
    }

    /*~
     * One element range index.
     */
    class ElementRangeIndex extends RangeIndex
    {
	static addToMap(map, json)
	{
	    RangeIndex.addToMap(map, json, idx => new ElementRangeIndex(idx));
	}

	static update(actions, objects, json, db)
	{
	    RangeIndex.update(actions, objects, json, db, ElementRangeIndex.prop,
			      ElementRangeIndex.value, 'element');
	}

	static value(ranges)
	{
	    // if there is no index, that will be an empty array, preventing the
	    // default DLS range indexes to be created
            return values(ranges)
		.map(idx => idx.create());
	}

        static create(db, ranges)
        {
            db[ElementRangeIndex.prop] = ElementRangeIndex.value(ranges);
        }

        constructor(json)
        {
	    super(json);
            this.name      = json.name;
            this.namespace = json.namespace || '';
        }

        create()
        {
            var obj = super.create();
	    obj['localname']     = this.name;
	    obj['namespace-uri'] = this.namespace;
            return obj;
        }

	updateDiffs(actions, name, actual, diffs)
	{
            if ( this.name !== actual['localname'] ) {
		diffs.push('name');
	    }
            if ( this.namespace !== actual['namespace-uri'] ) {
		diffs.push('namespace');
	    }
	}
    }
    ElementRangeIndex.prop = 'range-element-index';

    /*~
     * One attribute range index.
     */
    class AttributeRangeIndex extends ElementRangeIndex
    {
	static addToMap(map, json)
	{
	    RangeIndex.addToMap(map, json, idx => new AttributeRangeIndex(idx));
	}

	static update(actions, objects, json, db)
	{
	    RangeIndex.update(actions, objects, json, db, AttributeRangeIndex.prop,
			      AttributeRangeIndex.value, 'attribute');
	}

	static value(ranges)
	{
            return values(ranges)
		.map(idx => idx.create());
	}

        static create(db, ranges)
        {
            db[AttributeRangeIndex.prop] = AttributeRangeIndex.value(ranges);
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
    AttributeRangeIndex.prop = 'range-element-attribute-index';

    /*~
     * One path range index.
     */
    class PathRangeIndex extends RangeIndex
    {
	static addToMap(map, json)
	{
	    RangeIndex.addToMap(map, json, idx => new PathRangeIndex(idx));
	}

	static update(actions, objects, json, db)
	{
	    RangeIndex.update(actions, objects, json, db, PathRangeIndex.prop,
			      PathRangeIndex.value, 'path');
	}

	static value(ranges)
	{
            return values(ranges)
		.map(idx => idx.create());
	}

        static create(db, ranges)
        {
            db[PathRangeIndex.prop] = PathRangeIndex.value(ranges);
        }

        constructor(json)
        {
	    super(json);
            this.path = json.path;
        }

        create()
        {
            var obj = super.create();
	    obj['path-expression'] = this.path;
            return obj;
        }

	updateDiffs(actions, name, actual, diffs)
	{
	    super.updateDiffs(actions, name, actual, diffs);
            if ( this.path !== actual['path-expression'] ) {
		diffs.push('path');
	    }
	}
    }
    PathRangeIndex.prop = 'range-path-index';

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
		actions.add(new act.DatabaseUpdate(this.db, 'uri-lexicon', this.uri));
	    }
	    if ( ( this.coll !== undefined ) && ( this.coll !== body['collection-lexicon'] ) ) {
		logAdd(actions, 1, 'update', 'collection lexicon');
		actions.add(new act.DatabaseUpdate(this.db, 'collection-lexicon', this.coll));
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
