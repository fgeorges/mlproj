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
            this.id      = db.id;
            this.name    = db.name;
            this.forests = db.forests ? db.forests : [];
            this.indexes = new Indexes(db.indexes);
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
                'Create database: ' + this.name));
            // its forests
	    // TODO: Supports numeric values for forests, and default of "1"
            if ( this.forests ) {
                this.forests.forEach(f => {
                    actions.add(new act.Post(
                        '/forests',
                        { "forest-name": f, "database": this.name },
                        'Create forest: ' + f));
                });
            }
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
                'Create server: ' + this.name));
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
            if ( this.rangeElem.length ) {
                db['range-element-index'] = this.rangeElem.map(idx => idx.prepare());
            }
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
