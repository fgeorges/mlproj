"use strict";

(function() {

    const cmp = require('./components');

    /*~
     * Utility interface to abstract platform-dependent functionalities.
     */
    class Platform
    {
	debug(msg) {
	    throw new Error('Platform.debug is abstract');
	}
	log(msg) {
	    throw new Error('Platform.log is abstract');
	}
	info(msg) {
	    throw new Error('Platform.info is abstract');
	}
	warn(msg) {
	    throw new Error('Platform.warn is abstract');
	}
	resolve(href, base) {
	    throw new Error('Platform.resolve is abstract');
	}
	read(path) {
	    throw new Error('Platform.read is abstract');
	}
	green(s) {
	    throw new Error('Platform.green is abstract');
	}
	yellow(s) {
	    throw new Error('Platform.yellow is abstract');
	}
	red(s) {
	    throw new Error('Platform.red is abstract');
	}
	bold(s) {
	    throw new Error('Platform.bold is abstract');
	}
	get(url, error, success) {
	    throw new Error('Platform.get is abstract');
	}
	post(url, data, error, success) {
	    throw new Error('Platform.post is abstract');
	}
	put(url, data, error, success) {
	    throw new Error('Platform.put is abstract');
	}
    }

    /*~
     * One space, with its dependencies.
     */
    class Space
    {
        constructor(json)
        {
	    var that = this;
	    this._params    = json.params    || {};
	    this._databases = json.databases || [];
	    this._servers   = json.servers   || [];
	    this._imports   = [];
	    // extract defined values from `obj` and put them in `this.param`
	    var extract = function(obj, props) {
		props.forEach((p) => {
		    var v = obj[p];
		    if ( v !== undefined ) {
			that._params['@' + p] = v;
		    }
		});
	    };
	    // TODO: @srcdir should be initialized automatically to the project
	    // source dir (the subdir src/ in the dir containing xproject/),
	    // @srcdir being just a way to override it (or sometimes to set it,
	    // especially in tests.)
	    extract(json, ['code', 'title', 'srcdir']);
	    if ( json.connect ) {
		extract(json.connect, ['host', 'user', 'password']);
	    }
	}

	addImport(href, space)
	{
	    this._imports.push({
		href  : href,
		space : space
	    });
	}

	param(name)
	{
	    var v = this._params[name];
	    var i = this._imports.length;
	    while ( v === undefined && i > 0 ) {
		v = this._imports[--i].space.param(name);
	    }
	    return v;
	}

	databases()
	{
	    return this._allDbs.map(db => new cmp.Database(db));
	}

	servers()
	{
	    return this._allSrvs.map(srv => new cmp.Server(srv, this));
	}

	// cache databases and servers (resolving import priority)
	cache(platform)
	{
	    var ctxt = {
		href     : "@root",
		dbs      : [],
		dbIds    : {},
		dbNames  : {},
		srvs     : [],
		srvIds   : {},
		srvNames : {}
	    };
	    this.cacheImpl(ctxt, platform);
	    this._allDbs   = ctxt.dbs;
	    this._dbIds    = ctxt.dbIds;
	    this._dbNames  = ctxt.dbNames;
	    this._allSrvs  = ctxt.srvs;

	    // resolve databases "embedded" in databases and servers
	    var embed = (db) => {
		if ( db.idref ) {
		    if ( Object.keys(db).length > 1 ) {
			throw new Error('DB idref cannot have any other property: '
                            + JSON.stringify(db));
		    }
		    var res = this._dbIds[db.idref];
		    if ( ! res ) {
			throw new Error('DB id:' + db.idref + ' does not exist');
		    }
		    return res;
		}
		else if ( db.nameref ) {
		    if ( Object.keys(db).length > 1 ) {
			throw new Error('DB nameref cannot have any other property: '
                            + JSON.stringify(db));
		    }
		    var res = this._dbNames[db.nameref];
		    if ( ! res ) {
			throw new Error('DB name:' + db.nameref + ' does not exist');
		    }
		    return res;
		}
		else if ( ! db.name && ! db.id ) {
		    throw new Error('DB with no ID and no name in ' + JSON.stringify(db));
		}
		else if ( db.id && this._dbIds[db.id] ) {
		    throw new Error('Embedded DB id:' + db.id + ' already exists');
		}
		else if ( db.name && this._dbNames[db.name] ) {
		    throw new Error('Embedded DB name:' + db.name + ' already exists');
		}
		else {
		    this._allDbs.push(db);
		    if ( db.id ) {
			this._dbIds[db.id] = db;
		    }
		    if ( db.name ) {
			this._dbNames[db.name] = db;
		    }
		    return db;
		}
	    };
	    this._allSrvs.forEach((srv) => {
		if ( srv.content ) {
		    srv.content = embed(srv.content);
		}
		if ( srv.modules ) {
		    srv.modules = embed(srv.modules);
		}
	    });
	}

	// recursive implementation of cache(), caching databases and servers
	cacheImpl(ctxt, platform)
	{
	    // small helper to format info and error messages
	    var _ = (c) => {
		return 'id=' + c.id + '|name=' + c.name;
	    };

	    // the common implementation for databases and servers
	    var impl = (comp, cache, ids, names, kind) => {
		// at least one of ID and name mandatory
		if ( ! comp.name && ! comp.id ) {
		    throw new Error('No ID and no name on ' + kind + ' in ' + ctxt.href);
		}
		// default value for compose
		if ( ! comp.compose ) {
		    comp.compose = 'merge';
		}
		// does it exist yet?
		var derived =
		    ( comp.id && ids[comp.id] )
		    || ( comp.name && names[comp.name] );
		// if it does, perform the "compose" action..
		if ( derived ) {
		    if ( derived.compose !== comp.compose ) {
			throw new Error('Different compose actions for ' + kind + 's: derived:'
					+ _(derived) + '|compose=' + derived.compose + ' and base:'
					+ _(comp) + '|compose=' + comp.compose);
		    }
		    else if ( derived.compose === 'merge' ) {
			platform.info('Merge ' + kind + 's derived:' + _(derived) + ' and base:' + _(comp));
			var overriden = Object.keys(derived);
			for ( var p in comp ) {
			    if ( overriden.indexOf(p) === -1 ) {
				derived[p] = comp[p];
				if ( p === 'id' ) {
				    ids[derived.id] = derived;
				}
				else if ( p === 'name' ) {
				    names[derived.name] = derived;
				}
			    }
			}
		    }
		    else if ( derived.compose === 'hide' ) {
			platform.info('Hide ' + kind + ' base:' + _(comp) + ' by derived:' + _(derived));
		    }
		    else {
			throw new Error('Unknown compose on ' + kind + ': ' + _(derived) + '|compose=' + derived.compose);
		    }
		}
		// ...if it does not, just add it
		else {
		    cache.push(comp);
		    if ( comp.id ) {
			ids[comp.id] = comp;
		    }
		    if ( comp.name ) {
			names[comp.name] = comp;
		    }
		}
	    };

	    // cache databases
	    this._databases.forEach(db => {
		impl(db, ctxt.dbs, ctxt.dbIds, ctxt.dbNames, 'database');
	    });
	    // cache servers
	    this._servers.forEach(srv => {
		impl(srv, ctxt.srvs, ctxt.srvIds, ctxt.srvNames, 'server');
	    });
	    // recurse on imports
	    this._imports.forEach((i) => {
		ctxt.href = i.href;
		i.space.cacheImpl(ctxt, platform);
	    });
	}

	resolve(root)
	{
	    this.root = root;
	    this.resolveObject(this._params, true);
	    this.resolveArray(this._databases);
	    this.resolveArray(this._servers);
	    this._imports.forEach((i) => {
		i.space.resolve(root);
	    });
	}

	resolveThing(val, forbiden)
	{
	    if ( typeof val === 'string' ) {
		return this.resolveString(val, forbiden);
	    }
	    else if ( val instanceof Array ) {
		return this.resolveArray(val);
	    }
	    else if ( val instanceof Object ) {
		return this.resolveObject(val);
	    }
	    else {
		return val;
	    }
	}

	resolveArray(array)
	{
	    if ( ! array instanceof Array ) {
		throw new Error('Value not an array: ' + JSON.stringify(array));
	    }
	    for ( var i = 0; i < array.length; ++i ) {
		array[i] = this.resolveThing(array[i]);
	    }
	    return array;
	}

	resolveObject(obj, forbid)
	{
	    if ( ! obj instanceof Object ) {
		throw new Error('Value not an object: ' + JSON.stringify(obj));
	    }
	    for ( var p in obj ) {
		obj[p] = this.resolveThing(obj[p], forbid ? p : undefined);
	    }
	    return obj;
	}

	resolveString(val, forbiden)
	{
	    if ( ! val instanceof String ) {
		throw new Error('Value not a string: ' + JSON.stringify(val));
	    }
	    val = this.resolveVars(val, forbiden, '@', '@');
	    val = this.resolveVars(val, forbiden, '$', '');
	    return val;
	}

	resolveVars(str, forbiden, ch, prefix)
	{
	    var at = str.indexOf(ch);
	    // no more to escape
	    if ( at < 0 ) {
		return str;
	    }
	    // invalid ref
	    if ( str[at + 1] !== '{' ) {
		throw new Error('Invalid @ reference, { is missing: ' + str);
	    }
	    // first "}" after the "@"
	    var close = str.indexOf('}', at);
	    // invalid ref
	    if ( close < 0 ) {
		throw new Error('Invalid @ reference, } is missing: ' + str);
	    }
	    var name = str.slice(at + 2, close);
 	    // cannot use a param in its own value
	    if ( name === forbiden ) {
		throw new Error('Invalid @ reference, value references itself: ' + name);
	    }
 	    // name must be alphanumeric, with "-" separator
	    if ( name.search(/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/) < 0 ) {
		throw new Error('Invalid @ reference, invalid name: ' + name);
	    }
	    var val = this.root.param(prefix + name);
	    if ( ! val ) {
		throw new Error('No value for parameter: ' + name);
	    }
	    var resolved = str.slice(0, at) + val + str.slice(close + 1);
	    return this.resolveVars(resolved, forbiden);
	}

	static load(platform, href, base)
	{
	    // validate a few rules for one JSON file, return the mlproj sub-object
	    var validate = (json) => {
		var proj = json.mlproj;
		if ( ! proj ) {
		    throw new Error('Invalid file, must have the root `mlproj`');
		}
		if ( Object.keys(json).length !== 1 ) {
		    throw new Error('Invalid file, must have only one root');
		}
		if ( ! proj.format ) {
		    throw new Error('Invalid file, must have the property `format`');
		}
		if ( proj.format !== '0.1' ) {
		    throw new Error('Invalid file, `format` not 0.1: ' + proj.format);
		}
		return proj;
	    }
	    // recursive implementation
	    var impl = (href, base) => {
		var path    = platform.resolve(href, base);
		var json    = platform.read(path);
		var proj    = validate(json);
		var space   = new Space(proj);
		var imports = proj['import'];
		if ( typeof imports === 'string' ) {
		    imports = [ imports ];
		}
		if ( imports ) {
		    var idx = path.lastIndexOf('/');
		    if ( idx < 0 ) {
			throw new Error('File path does not have any slash: ' + path);
		    }
		    var newBase = path.slice(0, idx);
		    imports.forEach((i) => {
			// TODO: Should resolve properly against resolved `href`...
			var s = impl(i, newBase);
			space.addImport(i, s);
		    });
		}
		return space;
	    };
	    // start with root
	    var root = impl(href, base);
	    // resolve the param references
	    root.resolve(root);
	    // resolve import priority and cache databses and servers
	    root.cache(platform);
	    // return the loaded root (with imported spaces)
	    return root;
	}
    }

    module.exports = {
	Platform : Platform,
	Space    : Space
    };
}
)();
