"use strict";

(function() {

    const act = require('./action');

    /*~
     * Interface of a component.
     */
    class Component
    {
        prepare(actions) {
	    throw new Error('Component.prepare is abstract');
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
	    var that = this;
            this.id      = db.id;
            this.name    = db.name;
            this.forests = [];
            this.indexes = new Indexes(db.indexes);
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
		that.forests.push(new Forest(that, f));
	    });
        }

        prepare(actions)
        {
            var obj = {
                "database-name": this.name
            };
            this.indexes.prepare(obj);
            actions.add(new act.Post(
                '/databases',
                obj,
                'Create database: \t' + this.name));
            this.forests.forEach(f => f.prepare(actions));
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

        prepare(actions)
        {
            actions.add(new act.Post(
                '/forests',
                { "forest-name": this.name, "database": this.db.name },
                'Create forest:  \t' + this.name));
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

        prepare(actions)
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
	}
    }

    /*~
     * All the indexes of a database.
     */
    class Indexes
    {
        constructor(indexes)
        {
            this.rangeElem = [];
            // this.rangeAttr = [];
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
			    this.rangeElem.push(new ElementRangeIndex(idx));
			}
		    });
		}
		if ( keys.length ) {
		    throw new Error('Unknown index type(s): ' + keys);
		}
            }
        }

        prepare(db)
        {
            db['range-element-index'] = this.rangeElem.map(idx => idx.prepare());
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

        prepare()
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
    }

    module.exports = {
        Database : Database,
        Server   : Server
    }
}
)();
