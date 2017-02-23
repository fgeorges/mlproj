"use strict";

(function() {

    /*~
     * A single one action.
     */
    class Action
    {
        constructor(url, verb, msg, data)
        {
            this.url  = url;
            this.verb = verb;
            this.msg  = msg;
            this.data = data;
        }

        display(platform, indent)
        {
            platform.log(indent + ' ' + this.msg);
        }

        execute(platform, space, verbose, error, success)
	{
            platform.warn(platform.yellow('→') + ' ' + this.msg);
            if ( verbose ) {
                platform.warn('[' + platform.bold('verbose') + '] ' + this.verb + ' to ' + this.url);
		if ( this.data ) {
                    platform.warn('[' + platform.bold('verbose') + '] Body:');
                    platform.warn(this.data);
		}
            }
	    if ( platform.dry ) {
		success();
	    }
	    else {
		this.send(platform, this.url, this.data, error, success);
	    }
        }
    }

    /*~
     * A GET action.
     */
    class Get extends Action
    {
        constructor(url, msg) {
	    super(url, 'GET', msg);
        }

        send(platform, url, data, error, success) {
	    if ( data ) {
		throw new Error('Data in a GET: ' + url + ', ' + data);
	    }
	    platform.get(url, error, success);
        }
    }

    /*~
     * A POST action.
     */
    class Post extends Action
    {
        constructor(url, data, msg) {
	    super(url, 'POST', msg, data);
        }

        send(platform, url, data, error, success) {
	    platform.post(url, data, error, success);
        }
    }

    /*~
     * A PUT action.
     */
    class Put extends Action
    {
        constructor(url, data, msg) {
	    super(url, 'PUT', msg, data);
        }

        send(platform, url, data, error, success) {
	    platform.put(url, data, error, success);
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

        execute(space, callback)
        {
            if ( this.todo.length ) {
                var action = this.todo.shift();
                action.execute(this.platform, space, this.verbose, msg => {
                    this.error = { action: action, message: msg };
                    // stop processing
		    callback();
                }, () => {
                    this.done.push(action);
                    // TODO: Keep the idea of an event log?
                    // events.push('Database created: ' + db.name);
                    this.execute(space, callback);
                });
            }
	    else {
		callback();
	    }
        }

        summary()
        {
	    var _ = this.platform;
            if ( this.done.length ) {
                _.log(_.green('Done') + ':');
                this.done.forEach(a => a.display(_, _.green('✓')));
            }
            if ( this.error ) {
                _.log(_.red('Error') + ':');
                this.error.action.display(_, _.red('✗'));
                _.log(this.error.message);
            }
            if ( this.todo.length ) {
                _.log(_.yellow('Not done') + ':');
                this.todo.forEach(a => a.display(_, _.yellow('✗')));
            }
            if ( ! this.done.length && ! this.error && ! this.todo.length ) {
                _.log('Nothing to do.');
            }
        }
    }

    module.exports = {
        Get        : Get,
        Post       : Post,
        Put        : Put,
        ActionList : ActionList
    }
}
)();
