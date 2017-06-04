"use strict";

(function() {

    /*~~~~~ A HTTP action. */

    /*~
     * A single one action.
     */
    class Action
    {
        constructor(api, url, verb, msg, data)
        {
            this.api  = api;
            this.url  = url;
            this.verb = verb;
            this.msg  = msg;
            this.data = data;
        }

        display(platform, indent)
        {
            platform.log(indent + ' ' + this.msg);
        }

        execute(platform, error, success, dry)
        {
            if ( platform.verbose ) {
                platform.warn('[' + platform.bold('verbose') + '] '
                              + this.verb + ' to ' + this.url);
                if ( this.data && ! this.type) {
                    platform.warn('[' + platform.bold('verbose') + '] Body:');
                    platform.warn(this.data);
                }
            }
            if ( dry ) {
                platform.warn(platform.yellow('→') + ' ' + this.msg);
                success();
            }
            else {
                this.send(platform, this.api, this.url, this.data, error, success);
            }
        }
    }

    /*~~~~~ HTTP verb actions. */

    /*~
     * A GET action.
     */
    class Get extends Action
    {
        constructor(api, url, msg) {
            super(api, url, 'GET', msg);
        }

        send(platform, api, url, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
            if ( data ) {
                throw new Error('Data in a GET: ' + url + ', ' + data);
            }
            platform.get(api, url, error, success);
        }
    }

    /*~
     * A POST action.
     */
    class Post extends Action
    {
        constructor(api, url, data, msg) {
            super(api, url, 'POST', msg, data);
        }

        send(platform, api, url, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
            platform.post(api, url, data, error, success, this.type);
        }
    }

    /*~
     * A PUT action.
     */
    class Put extends Action
    {
        constructor(api, url, data, msg) {
            super(api, url, 'POST', msg, data);
        }

        send(platform, api, url, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
            platform.put(api, url, data, error, success, this.type);
        }
    }

    /*~~~~~ Management API actions. */

    /*~
     * A Management API GET action.
     */
    class ManageGet extends Get
    {
        constructor(url, msg) {
            super('management', url, msg);
        }
    }

    /*~
     * A Management API POST action.
     */
    class ManagePost extends Post
    {
        constructor(url, data, msg) {
            super('management', url, data, msg);
        }
    }

    /*~
     * A Management API PUT action.
     */
    class ManagePut extends Put
    {
        constructor(url, data, msg) {
            super('management', url, data, msg);
        }
    }

    /*~
     * Management API: list all forests.
     */
    class ForestList extends ManageGet
    {
        constructor() {
            super('/forests', 'Retrieve forests');
        }

        send(platform, api, url, data, error, success) {
            super.send(platform, api, url, data, error, body => {
                success(body);
            });
        }
    }

    /*~
     * Management API: create a forest.
     */
    class ForestCreate extends ManagePost
    {
        constructor(forest) {
            super('/forests',
                  { "forest-name": forest.name, "database": forest.db.name },
                  'Create forest:  \t\t' + forest.name);
        }
    }

    /*~
     * Management API: attach a forest.
     */
    class ForestAttach extends ManagePost
    {
        constructor(forest) {
            super('/forests/' + forest.name + '?state=attach&database=' + forest.db.name,
                  null,
                  'Attach forest:  \t\t' + forest.name);
        }
    }

    /*~
     * Management API: detach a forest.
     */
    class ForestDetach extends ManagePost
    {
        constructor(forest) {
            super('/forests/' + forest.name + '?state=detach',
                  null,
                  'Detach forest:  \t\t' + forest.name);
        }
    }

    /*~
     * Management API: retrieve properties of a database.
     */
    class DatabaseProps extends ManageGet
    {
        constructor(db) {
            super('/databases/' + db.name + '/properties',
                  'Retrieve database props: \t' + db.name);
        }
    }

    /*~
     * Management API: create a database.
     */
    class DatabaseCreate extends ManagePost
    {
        constructor(db, body) {
            super('/databases',
                  body,
                  'Create database: \t\t' + db.name);
        }
    }

    /*~
     * Management API: update a database property.
     */
    class DatabaseUpdate extends ManagePut
    {
        constructor(db, name, value) {
            super('/databases/' + db.name + '/properties',
                  { [name]: value },
                  'Update ' + name + ':  \t' + db.name);
        }
    }

    /*~
     * Management API: retrieve properties of a server.
     */
    class ServerProps extends ManageGet
    {
        constructor(srv) {
            super('/servers/' + srv.name + '/properties?group-id=' + srv.group,
                  'Retrieve server props: \t' + srv.name);
        }
    }

    /*~
     * Management API: create a server.
     */
    class ServerCreate extends ManagePost
    {
        constructor(srv, body) {
            super('/servers?group-id=' + srv.group,
                  body,
                  'Create server: \t\t' + srv.name);
        }
    }

    /*~
     * Management API: update a server property.
     */
    class ServerUpdate extends ManagePut
    {
        constructor(srv, name, value) {
            super('/servers/' + srv.name + '/properties?group-id=' + srv.group,
                  { [name]: value },
                  'Update ' + name + ':  \t' + srv.name);
        }
    }

    /*~~~~~ Client API actions. */

    /*~
     * A Client API GET action.
     */
    class ClientGet extends Get
    {
        constructor(url, msg) {
            super('client', url, msg);
        }
    }

    /*~
     * A Client API POST action.
     */
    class ClientPost extends Post
    {
        constructor(url, data, msg) {
            super('client', url, data, msg);
        }
    }

    /*~
     * A Client API PUT action.
     */
    class ClientPut extends Put
    {
        constructor(url, data, msg) {
            super('client', url, data, msg);
        }
    }

    /*~
     * Client API: insert a document.
     *
     * Using this API for inserting docuemnts is deeeaaaad slow.  Especially for
     * *.xq files on the EXPath Console.  No idea why.  So invoke XDBC instead,
     * see below.
     */
    /*
    class DocInsert extends ClientPut
    {
        constructor(db, uri, doc) {
            super('/documents?uri=' + uri + '&database=' + db.name,
                  doc,
                  'Insert document: \t' + uri);
            this.type = 'text/plain';
        }
    }
    */

    /*~~~~~ XDBC actions. */

    /*~
     * An XDBC PUT action.
     */
    class XdbcPut extends Put
    {
        constructor(url, data, msg) {
            super('xdbc', url, data, msg);
        }
    }

    /*~
     * XDBC: insert a document.
     */
    class DocInsert extends XdbcPut
    {
        constructor(db, uri, doc) {
            // TODO: Add "perm" parameters.
            // TODO: Add "format" parameter (xml, text, binary)
            super('/insert?uri=' + uri + '&dbname=' + db.name,
                  doc,
                  'Insert document: \t' + uri);
            // TODO: Should we use something else?  XDBC/XCC is bad (is not!) documented...
            this.type = 'text/plain';
        }
    }

    /*~
     * A list of actions.
     */
    class ActionList
    {
        constructor(platform)
        {
            this.platform = platform;
            this.todo     = [];
            this.done     = [];
            this.error    = null;
        }

        add(a)
        {
            this.todo.push(a);
        }

        execute(callback)
        {
            if ( this.todo.length ) {
                var action = this.todo.shift();
                action.execute(this.platform, msg => {
                    this.error = { action: action, message: msg };
                    // stop processing
                    callback();
                }, () => {
                    this.done.push(action);
                    // TODO: Keep the idea of an event log?
                    // events.push('Database created: ' + db.name);
                    this.execute(callback);
                },
                this.platform.dry);
            }
            else {
                callback();
            }
        }

        summary(skipdone)
        {
            var pf = this.platform;
            if ( ! skipdone && this.done.length ) {
                pf.log(pf.green('Done') + ':');
                this.done.forEach(a => a.display(pf, pf.green('✓')));
            }
            if ( this.error ) {
                pf.log(pf.red('Error') + ':');
                this.error.action.display(pf, pf.red('✗'));
                pf.log(this.error.message);
            }
            if ( this.todo.length ) {
                pf.log(pf.yellow('Not done') + ':');
                this.todo.forEach(a => a.display(pf, pf.yellow('✗')));
            }
            if ( ! this.done.length && ! this.error && ! this.todo.length ) {
                pf.log('Nothing to do.');
            }
        }
    }

    module.exports = {
        ForestList     : ForestList,
        ForestCreate   : ForestCreate,
        ForestAttach   : ForestAttach,
        ForestDetach   : ForestDetach,
        DatabaseProps  : DatabaseProps,
        DatabaseCreate : DatabaseCreate,
        DatabaseUpdate : DatabaseUpdate,
        ServerProps    : ServerProps,
        ServerCreate   : ServerCreate,
        ServerUpdate   : ServerUpdate,
        DocInsert      : DocInsert,
        ActionList     : ActionList
    }
}
)();
