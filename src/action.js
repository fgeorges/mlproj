"use strict";

(function() {

    /*~~~~~ A HTTP action. */

    /*~
     * A single one action.
     */
    class Action
    {
        constructor(endpoint, msg, data)
        {
	    // must have props: url, verb, api, port
	    // e.g.: { url: '/databases', verb: 'GET', api: 'manage/v2', port: 8002 }
            this.endpoint = endpoint;
            this.msg      = msg;
            this.data     = data;
        }

        display(platform, indent)
        {
            platform.log(indent + ' ' + this.msg);
        }

        execute(platform, verbose, error, success, dry)
	{
            if ( verbose ) {
                platform.warn('[' + platform.bold('verbose') + '] '
			      + this.endpoint.verb + ' to ' + this.endpoint.url);
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
		this.send(platform, this.endpoint, this.data, error, success);
	    }
        }
    }

    /*~~~~~ HTTP verb actions. */

    /*~
     * A GET action.
     */
    class Get extends Action
    {
        constructor(url, msg, api, port) {
	    super({ url: url, verb: 'GET', api: api, port: port }, msg);
        }

        send(platform, endpoint, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
	    if ( data ) {
		throw new Error('Data in a GET: ' + url + ', ' + data);
	    }
	    platform.get(endpoint, error, success);
        }
    }

    /*~
     * A POST action.
     */
    class Post extends Action
    {
        constructor(url, data, msg, api, port) {
	    super({ url: url, verb: 'POST', api: api, port: port }, msg, data);
        }

        send(platform, endpoint, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
	    platform.post(endpoint, data, error, success, this.type);
        }
    }

    /*~
     * A PUT action.
     */
    class Put extends Action
    {
        constructor(url, data, msg, api, port) {
	    super({ url: url, verb: 'PUT', api: api, port: port }, msg, data);
        }

        send(platform, endpoint, data, error, success) {
            platform.warn(platform.yellow('→') + ' ' + this.msg);
	    platform.put(endpoint, data, error, success, this.type);
        }
    }

    /*~~~~~ Management API actions. */

    /*~
     * A Management API GET action.
     */
    class ManageGet extends Get
    {
        constructor(url, msg) {
	    super(url, msg, 'manage/v2', 8002);
        }
    }

    /*~
     * A Management API POST action.
     */
    class ManagePost extends Post
    {
        constructor(url, data, msg) {
	    super(url, data, msg, 'manage/v2', 8002);
        }
    }

    /*~
     * A Management API PUT action.
     */
    class ManagePut extends Put
    {
        constructor(url, data, msg) {
	    super(url, data, msg, 'manage/v2', 8002);
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

        send(platform, endpoint, data, error, success) {
	    if ( ForestList.cache ) {
		success(ForestList.cache);
	    }
	    else {
		super.send(platform, endpoint, data, error, body => {
		    ForestList.cache = body;
		    success(body);
		});
	    }
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
	    super(url, msg, 'v1', 8000);
        }
    }

    /*~
     * A Client API POST action.
     */
    class ClientPost extends Post
    {
        constructor(url, data, msg) {
	    super(url, data, msg, 'v1', 8000);
        }
    }

    /*~
     * A Client API PUT action.
     */
    class ClientPut extends Put
    {
        constructor(url, data, msg) {
	    super(url, data, msg, 'v1', 8000);
        }
    }

    /*~
     * Client API: insert a document.
     */
    class DocInsert extends ClientPut
    {
        constructor(db, uri, doc) {
	    super('/documents?uri=' + uri + '&database=' + db.name,
		  doc,
		  'Insert document: \t' + uri);
	    this.type = 'text/plain';
        }
    }

    /*~
     * A list of actions.
     */
    class ActionList
    {
        constructor(platform, verbose)
        {
            this.platform = platform;
            this.verbose  = verbose;
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
                action.execute(this.platform, this.verbose, msg => {
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

        summary()
        {
	    var pf = this.platform;
            if ( this.done.length ) {
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
