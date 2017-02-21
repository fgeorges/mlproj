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

        display(platform)
        {
            platform.log(this.msg);
        }

        execute(platform, space, verbose, error, success)
	{
            platform.warn(platform.green('post') + '  ' + this.msg);
            var url = 'http://' + space.param('@host') + ':8002/manage/v2' + this.url;
            if ( verbose ) {
                platform.warn('[' + platform.bold('verbose') + '] ' + this.verb + ' to ' + url);
		if ( this.data ) {
                    platform.warn('[' + platform.bold('verbose') + '] Body:');
                    platform.warn(this.data);
		}
            }
            var user = space.param('@user');
            var pwd  = space.param('@password');
	    this.send(platform, url, this.data, user, pwd, error, success);
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

        send(platform, url, data, user, pwd, error, success) {
	    if ( data ) {
		throw new Error('Data in a GET: ' + url + ', ' + data);
	    }
	    platform.get(url, user, pwd, error, success);
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

        send(platform, url, data, user, pwd, error, success) {
	    if ( ! data ) {
		throw new Error('No data in a POST: ' + url);
	    }
	    platform.post(url, data, user, pwd, error, success);
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

        execute(space)
        {
            if ( ! this.todo.length ) {
                // nothing left to do
                this.display();
            }
            else {
                var action = this.todo.shift();
                action.execute(this.platform, space, this.verbose, msg => {
                    this.error = { action: action, message: msg };
                    // stop processing
                    this.display();
                }, () => {
                    this.done.push(action);
                    // TODO: Keep the idea of an event log?
                    // events.push('Database created: ' + db.name);
                    this.execute(space);
                });
            }
        }

        display()
        {
	    var _ = this.platform;
            _.log('--- ' + _.bold('Summary') + ' ---');
            if ( this.done.length ) {
                _.log(_.green('Done') + ':');
                this.done.forEach(a => a.display(_));
            }
            if ( this.error ) {
                _.log(_.red('Error') + ': ' + this.error.message);
                this.error.action.display(_);
            }
            if ( this.todo.length ) {
                _.log(_.yellow('Not done') + ':');
                this.todo.forEach(a => a.display(_));
            }
        }
    }

    module.exports = {
        Get        : Get,
        Post       : Post,
        ActionList : ActionList
    }
}
)();
