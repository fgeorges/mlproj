"use strict";

(function() {

    function _addArgument(prg, clazz, args) {
        let name = args.shift();
        let desc = args.pop();
        let arg = new clazz(name, args, desc);
        args.forEach(f => {
            if ( prg.args[f] ) {
                throw new Error('Flag ' + f + ' already given');
            }
            prg.args[f] = arg;
        });
        if ( prg.keys[name] ) {
            throw new Error('Argument ' + name + ' already given');
        }
        prg.keys[name] = arg;
        return arg;
    }

    class Argument
    {
        constructor(name, flags, desc) {
            this.name  = name;
            this.flags = flags;
            this.desc  = desc;
        }

        // check the exclusive group
        found(res, arg, args) {
            if ( this.group ) {
                this.group.args.forEach(a => {
                    if ( res[a.name] ) {
                        throw new Error('Arg ' + a.name + ' already set, exclusif with: ' + this.name);
                    }
                });
            }
        }
    }

    class Flag extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( res[this.name] ) {
                throw new Error('Option ' + arg + ' already given using ' + res[this.name]);
            }
            res[this.name] = arg;
        }
    }

    class Map extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( ! args.length ) {
                throw new Error('No value for option ' + arg);
            }
            let item = args.shift();
            var idx  = item.indexOf(':');
            if ( idx < 0 ) {
                idx = item.indexOf('=');
            }
            if ( idx < 0 ) {
                throw new Error('Invalid param, must use : or = between name and value');
            }
            var name  = item.slice(0, idx);
            var value = item.slice(idx + 1);
            if ( ! res[this.name] ) {
                res[this.name] = {};
            }
            if ( res[this.name][name] ) {
                throw new Error('Entry ' + name + ' of option ' + arg + ' already given using ' + res[this.name][name]);
            }
            res[this.name][name] = value;
        }
    }

    class Option extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( ! args.length ) {
                throw new Error('No value for option ' + arg);
            }
            if ( res[this.name] ) {
                throw new Error('Option ' + arg + ' already given value: ' + res[this.name]);
            }
            res[this.name] = args.shift();
        }
    }

    class Arg extends Argument
    {
        constructor(name, flags, desc) {
            super(name, flags, desc);
        }

        found(res, arg, args) {
            super.found(res, arg, args);
            if ( res[this.name] ) {
                throw new Error('Unnamed argument  already given: ' + res[this.name]);
            }
            res[this.name] = arg;
        }
    }

    class ArgumentGroup
    {
        constructor(prg) {
            // program, or command
            this.prg     = prg;
            this.options = {};
            this._arg    = null;
            this.args    = [];
        }

        arg(name) {
            let arg = this.prg.arg(name);
            this._arg = arg;
            arg.group = this;
            this.args.push(arg);
            return this;
        }

        option() {
            let arg = _addArgument(this.prg, Option, Array.from(arguments));
            arg.flags.forEach(f => {
                this.options[f] = arg;
            });
            arg.group = this;
            this.args.push(arg);
            return this;
        }

        end() {
            let prg = this.prg;
            this.prg = null;
            return prg;
        }
    }

    class Program
    {
        constructor() {
            this.args     = {};
            this.keys     = {};
            this.commands = {};
        }

        version(ver) {
            this._version = ver;
            return this;
        }

        flag() {
            _addArgument(this, Flag, Array.from(arguments));
            return this;
        }

        map() {
            _addArgument(this, Map, Array.from(arguments));
            return this;
        }

        option() {
            _addArgument(this, Option, Array.from(arguments));
            return this;
        }

        or() {
            return new ArgumentGroup(this);
        }

        command(name) {
            let cmd = new Command(this, name);
            // TODO: Check does not exist yet...
            this.commands[name] = cmd;
            return cmd;
        }

        parse(argv) {
            let args = Array.from(argv);
            let res  = {
                global : {},
                cmd    : null,
                local  : {}
            };
            let cmd;
            while ( args.length && ! cmd ) {
                let arg = args.shift();
                let opt = this.args[arg];
                if ( opt ) {
                    opt.found(res.global, arg, args);
                }
                else {
                    cmd = this.commands[arg];
                    if ( ! cmd ) {
                        throw new Error('No such option or command: ' + arg);
                    }
                    res.cmd = arg;
                }
            }
            while ( args.length ) {
                let arg = args.shift();
                let opt = cmd.args[arg];
                if ( opt ) {
                    opt.found(res.local, arg, args);
                }
                else if ( cmd._arg ) {
                    cmd._arg.found(res.local, arg, args);
                }
                else {
                    throw new Error('No such command option: ' + arg);
                }
            }
            return res;
        }
    }

    class Command
    {
        constructor(prg, name) {
            this.prg  = prg;
            this.name = name;
            this.args = {};
            this._arg = null;
            this.keys = {};
        }

        option() {
            _addArgument(this, Option, Array.from(arguments));
            return this;
        }

        arg() {
            if ( this._arg ) {
                throw new Error('There is already an unnamed arg on command ' + this.name);
            }
            this._arg = _addArgument(this, Arg, Array.from(arguments));
            return this;
        }

        or() {
            return new ArgumentGroup(this);
        }
    }

    module.exports = {
        Program : Program
    }
}
)();
