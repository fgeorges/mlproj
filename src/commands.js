"use strict";

(function()
 {
     const fs  = require('fs');
     const lib = require('./lib');

     class SetupCommand
     {
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

         prepare(path)
         {
             this.path    = path;
             this.env     = getEnv(path);
             this.actions = new lib.ActionList();
             // actions to create databases
             this.env.databases.forEach(db => {
                 // the database itself
                 this.actions.add(new lib.Action(
                     '/databases',
                     { "database-name": db.name },
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
                 var body = {
                     "server-name":      srv.name,
                     "port":             srv.port,
                     "root":             srv.root,
                     "content-database": srv.content.name,
                     "server-type":      srv.type
                 };
                 if ( srv.modules.name ) {
                     body['modules-database'] = srv.modules.name;
                 }
                 this.actions.add(new lib.Action(
                     // TODO: Support group-id other than Default...
                     '/servers?group-id=Default',
                     body,
                     'Create server: ' + srv.name));
             });
         }

         execute() {
             this.actions.execute(this.env);
         }
     }

     function getEnv(path)
     {
         try {
             var file = fs.readFileSync(path, 'utf8');
             var env  = JSON.parse(file);
             if ( ! env.mlproj ) {
                 throw new Error('Not a proper mlproj environment: ' + path);
             }
             return env.mlproj;
         }
         catch ( err ) {
             if ( err.code === 'ENOENT' ) {
                 throw new Error('Environment file does not exist: ' + path);
             }
             else {
                 throw err;
             }
         }
     }

     module.exports = {
         SetupCommand : SetupCommand
     }
 }
)();
