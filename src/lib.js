"use strict";

(function()
 {
     var request = require('request');

     /*~
      * A single one action.
      */
     class Action
     {
         constructor(url, data, msg)
         {
             this.url  = url;
             this.data = data;
             this.msg  = msg;
         }

         display()
         {
             console.log(this.msg);
         }

         execute(env, verbose, error, success)
         {
             console.warn(green('post') + '  ' + this.msg);
             var url = 'http://' + env.backstage.host + ':8002/manage/v2' + this.url;
             if ( verbose ) {
                 console.warn('[' + bold('verbose') + '] POST to ' + url);
                 console.warn('[' + bold('verbose') + '] Body:');
                 console.warn(this.data);
             }
             request.post(
                 {
                     url:  url,
                     json: this.data,
                     auth: {
                         user: env.backstage.admin.user,
                         pass: env.backstage.admin.password,
                         sendImmediately: false
                     }
                 },
                 (err, http, body) => {
                     if ( err ) {
                         error('Error creating a database: ' + err);
                     }
                     else if ( http.statusCode !== 201 ) {
                         error('Entity not created: ' + body.errorResponse.message);
                     }
                     else {
                         success();
                     }
                 });
         }
     }

     /*~
      * A list of actions.
      */
     class ActionList
     {
         constructor(v)
         {
             this.verbose = v;
             this.todo    = [];
             this.done    = [];
             this.error   = null;
         }

         add(a)
         {
             this.todo.push(a);
         }

         execute(env)
         {
             if ( ! this.todo.length ) {
                 // nothing left to do
                 this.display();
             }
             else {
                 var action = this.todo.shift();
                 action.execute(env, this.verbose, msg => {
                     this.error = { action: action, message: msg };
                     // stop processing
                     this.display();
                 }, () => {
                     this.done.push(action);
                     // TODO: Keep the idea of an event log?
                     // events.push('Database created: ' + db.name);
                     this.execute(env);
                 });
             }
         }

         display()
         {
             if ( this.done.length ) {
                 console.log(green('Done') + ':');
                 this.done.forEach(a => a.display());
             }
             if ( this.error ) {
                 console.log(red('Error') + ': ' + this.error.message);
                 this.error.action.display();
             }
             if ( this.todo.length ) {
                 console.log(yellow('Not done') + ':');
                 this.todo.forEach(a => a.display());
             }
         }
     }

     /*~~~~~
      * Functions to turn a string into bold, green, yellow or red resp. (for
      * the interactive console).
      */

     function bold(s)
     {
         return '\u001b[1m' + s + '\u001b[22m'
     }

     function green(s)
     {
         return '\u001b[32m' + s + '\u001b[39m'
     }

     function yellow(s)
     {
         return '\u001b[33m' + s + '\u001b[39m'
     }

     function red(s)
     {
         return '\u001b[35m' + s + '\u001b[39m'
     }

     module.exports = {
         Action     : Action,
         ActionList : ActionList,
         red        : red
     };
 }
)();
