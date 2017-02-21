"use strict";

(function() {

    /*~
     * Interface of a component.
     */
    class Component
    {
        api() {
	    throw new Error('Component.api is abstract');
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

        api()
        {
            var obj = {
                "database-name": this.name
            };
            this.indexes.api(obj);
            return obj;
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

        api()
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
            return obj;
        }
    }

    /*~
     * All the indexes of a database.
     */
    class Indexes extends Component
    {
        constructor(indexes)
        {
	    super();
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

        api(db)
        {
            if ( this.rangeElem.length ) {
                db['range-element-index'] = this.rangeElem.map(idx => idx.api());
            }
        }
    }

    /*~
     * One range index.
     */
    class ElementRangeIndex extends Component
    {
        constructor(idx)
        {
	    super();
            this.type      = idx.type;
            this.name      = idx.name;
            this.positions = idx.positions;
            this.invalid   = idx.invalid;
            this.namespace = idx.namespace ? idx.namespace : '';
            this.collation = idx.collation ? idx.collation : 'http://marklogic.com/collation/';
        }

        api()
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
