"use strict";

(function()
 {
     const fs  = require('fs');
     const lib = require('./lib');

     class SetupCommand
     {
         constructor() {
             this._verbose = false;
         }

         command() {
             return 'setup <path>';
         }

         description() {
             return 'setup the given environment';
         }

         options() {
             return [
                 // { option: '-s, --setup_mode [mode]', label: 'some local option' }
             ];
         }

         verbose(v) {
             this._verbose = v;;
         }

         prepare(path)
         {
             this.path    = path;
             this.env     = new Environ(path);
             this.actions = new lib.ActionList(this._verbose);
             // actions to create databases
             this.env.databases.forEach(db => {
                 // the database itself
                 this.actions.add(new lib.Action(
                     '/databases',
                     db.api(),
                     'Create database: ' + db.name));
                 // its forests
                 if ( db.forests ) {
                     db.forests.forEach(f => {
                         this.actions.add(new lib.Action(
                             '/forests',
                             { "forest-name": f, "database": db.name },
                             'Create forest: ' + f));
                     });
                 }
             });
             // actions to create servers
             this.env.servers.forEach(srv => {
                 this.actions.add(new lib.Action(
                     // TODO: Support group-id other than Default...
                     '/servers?group-id=Default',
                     srv.api(),
                     'Create server: ' + srv.name));
             });
         }

         execute() {
             this.actions.execute(this.env);
         }
     }

     class Environ
     {
         constructor(path)
         {
             var json = readJson(path);
             var env  = json.mlproj;
             if ( ! env ) {
                 throw new Error('Not a proper mlproj environment: ' + path);
             }
             this.path      = path;
             this.backstage = env.backstage;
             this.info      = env.info;
             this.config    = env.config;
             this.databases = env.databases
                 ? env.databases.map(db => new Database(db))
                 : [];
             this.servers   = env.servers
                 ? env.servers.map(srv => new Server(srv))
                 : [];
         }
     }

     class Database
     {
         constructor(db)
         {
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

     class Server
     {
         constructor(srv)
         {
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
             if ( this.modules.name ) {
                 obj['modules-database'] = this.modules.name;
             }
             return obj;
         }
     }

     class Indexes
     {
         constructor(indexes)
         {
             this.rangeElem = [];
             // this.rangeAttr = [];
             // ...
             if ( indexes ) {
                 indexes.forEach(idx => this.makeIndex(idx));
             }
         }

         makeIndex(idx)
         {
             var keys = Object.keys(idx);
             if ( keys.length !== 1 ) {
                 throw new Error('Indexes must have exactly one type: ' + keys);
             }
             var type = keys[0];
             var obj  = idx[type];
             switch ( type ) {
             case 'range':
                 if ( obj.parent ) {
                     // this.rangeAttr.push(new AttributeRangeIndex(obj));
                     throw new Error('Attribute range index not supported yet');
                 }
                 else {
                     this.rangeElem.push(new ElementRangeIndex(obj));
                 }
                 break;
             default:
                 throw new Error('Index type not supported (yet?): ' + type);
             }
         }

         api(db)
         {
             if ( this.rangeElem.length ) {
                 db['range-element-index'] = this.rangeElem.map(idx => idx.api());
             }
         }
     }

     class ElementRangeIndex
     {
         constructor(idx)
         {
             this.type      = idx.type;
             this.localname = idx.localname;
             this.positions = idx.positions;
             this.invalid   = idx.invalid;
             this.namespace = idx.namespace ? idx.namespace : '';
             this.collation = idx.collation ? idx.collation : 'http://marklogic.com/collation/';
         }

         api()
         {
             var obj = {
                 "scalar-type":           this.type,
                 "localname":             this.localname,
                 "range-value-positions": this.positions,
                 "invalid-values":        this.invalid,
                 "namespace-uri":         this.namespace,
                 "collation":             this.collation
             };
             return obj;
         }
     }

     function readJson(path)
     {
         var file;
         try {
             file = fs.readFileSync(path, 'utf8');
         }
         catch ( err ) {
             if ( err.code === 'ENOENT' ) {
                 throw new Error('File does not exist: ' + path);
             }
             else {
                 throw err;
             }
         }
         return JSON.parse(file);
     }

     module.exports = {
         SetupCommand : SetupCommand
     }
 }
)();
