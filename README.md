# mlproj

Project and environment manager for MarkLogic.

This is work in progress.  Use at your own risks.  The website is in progress as
well: http://mlproj.org/.

![Animated intro](dev/mlproj-intro.gif)

## Install

Use the following:

```
npm install mlproj -g
```

This needs Node to be installed on your system.  Package managers for all
systems include it.  Look at [Node](http://nodejs.org/) website for details and
install options.

## Features

`mlproj` let you manage, deploy and configure MarkLogic projects.  In order to
achieve this, it also let you describe your environments and automatically set
them up.

The `mlproj` program provides several commands.  For an accurate list of them,
type:

```
fgeorges@callisto:~$ mlproj help

  Usage: mlproj [options] [command]

  Commands:

    help     use `help <command>` for help on sub-commands
    new      create a new project in an empty dir
    show     display the environment
    setup    setup the environment on MarkLogic
    deploy   deploy modules to the modules database

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -c, --code <code>         set/override the @code
    -d, --dry                 dry run
    -e, --environ <name>      environment name
    -f, --file <file>         environment file
    -h, --host <host>         set/override the @host
    -p, --param <name:value>  set/override a parameter value (use : or =)
    -s, --srcdir <dir>        set/override the @srcdir
    -u, --user <user>         set/override the @user
    -v, --verbose             verbose mode
    -z, --password            ask for password interactively

fgeorges@callisto:~$ 
```

Here is an abstract of each command:

- `help` - display help about other individual commands
- `new` - create a new project, asking for a few questions
- `show` - display a view of the given environment, with values resolved
- `setup` - actually create databases, forests and servers (or adapt
  them if they already exist and differ from what is in the
  environment files)
- `deploy` - deploy modules from the source directory to the modules
  database

## Environments

The command `mlproj setup` relies on environment files.  These files describe
databases, forests and servers.  The command then simply ensure they exist, and
creates and/or update them as necessary.  This is a simple example:

```json
{ "mlproj": {
    "format": "0.1",
    "code":   "myapp",
    "title":  "Simple example of an environment description",
    "connect": {
        "host":     "localhost",
        "user":     "admin",
        "password": "admin"
    },
    "params": {
        "port": "8080"
    },
    "servers": [{
        "name": "@{code}",
        "type": "http",
        "port": "${port}",
        "root": "/",
        "content": {
            "name": "@{code}-content"
        },
        "modules": {
            "name": "@{code}-modules"
        }
    }]
}
```

If this file is named, say, `local.json`, then the command `mlproj -e local
setup` will show the following, first time it is executed:

```
--- Prepare ---
• checking the database:        myapp-content
  need to create database:      myapp-content
   • checking forests
     need to create forest:     myapp-content-001
• checking the database:        myapp-modules
  need to create database:      myapp-modules
   • checking forests
     need to create forest:     myapp-modules-001
• checking the http server:     myapp
  need to create server:        myapp

--- Progress ---
→ Create database:              myapp-content
→ Create forest:                myapp-content-001
→ Create database:              myapp-modules
→ Create forest:                myapp-modules-001
→ Create server:                myapp

--- Summary ---
Done:
✓ Create database:              myapp-content
✓ Create forest:                myapp-content-001
✓ Create database:              myapp-modules
✓ Create forest:                myapp-modules-001
✓ Create server:                myapp
```

Even if this is a quite simple example, it already shows interesting features:

- meta information about the application (code, title)
- connection info (host, credentials)
- one server with a content and a modules database
- declaration of parameters for internal usage (the port number)
- substitution of variables (`@{code}`, `${port}`)

### How to pass environments

There are 2 ways of passing an environment file to `mlproj`.  Either with the
`-e` or with the `-f` option.  The `-f` option simply passes the complete path
to the file (relative to the current directory).

The `-e` option takes a simple "environment name".  It requires the current
directory to be the project directory, and to have an `xproject/ml/`
sub-directory in it.  The "environment name" is then used to construct the name
of the file, by appending `.json` at the end.

Using `-e local` for instance, is equivalent to `-f xproject/ml/local.json`.

`mlproj` will eventually help to create and maintain a standard `XProject`
directory structure for your MarkLogic project.

### Environment files

Examples of environment files can be found in
the [test/spaces/](http://github.com/fgeorges/mlproj/tree/master/test/spaces)
directory.

The environment files can have the following format:

```json
{ "mlproj": {
    "format": "0.1",
    "import": "base.json",
    "code":   "my-fabulous-app",
    "title":  "Short title for the project",
    "desc":   "Longer description of the project.  You can use Markdown.",
    "srcdir": "...",
    "connect": {
        "host":     "...",
        "user":     "...",
        "password": "..."
    },
    "params": {
        "..."
    },
    "databases": [{
        "..."
    }],
    "servers": [{
        "..."
    }]
}
```

All properties are optional, except for `format`, which is the version of the
file format, for now always `0.1` (untill it stabilizes).

There is an import mechanism.  Even though all properties are optional in each
file, after import resolution the following properties must have been set:

- `code`
- `title`
- `connect.host`
- `connect.user`
- `connect.password`

**Imports**

The `import` value is a path to another file to import, relative to the current
file.  Usually it is simply a file name, as they are all grouped in the same
directory.  Starting at one file, it `import` is resolved if any, then
recursively all their imports are resolved, to get a larger environment object.

At each step, if the imported file contains a parameter already existing in an
importing file, it is "overriden" (hidden).

At each step, if the imported file contains a component (database or server)
already existing in an importing file (same ID or same name), it is "merged".
The properties of that component in the importing file hide the properties with
the same name in the imported file.

If you want a component to entirely override one with the same name in an
imported file, use the property `compose` with the value `hide`.  By default it
is `merge`.

Let say we point to the following environment file:

```json
{ "mlproj": {
    "format": "0.1",
    "import": "base.json",
    "connect": {
        "host":     "localhost",
        "user":     "admin",
        "password": "admin"
    },
    "params": {
        "port": 8099
    },
    "servers": [{
        "id": "server",
        "modules": {
		    "name": "@{code}-modules"
		}
    }]
}
```

and the following in `base.json`:

```json
{ "mlproj": {
    "format": "0.1",
    "code":   "my-app",
    "title":  "My project",
    "params": {
        "port": 8080,
		"root": "/"
    },
    "databases": [{
        "id":   "content",
        "name": "@{code}-content"
    }],
    "servers": [{
        "id":   "server",
        "name": "@{code}",
        "type": "http",
        "port": "${port}",
        "root": "${root}",
        "content": {
		    "idref": "content"
		}
    }]
}
```

The it is somewhat equivalent to the following file, where imports and variable
substitutions have been resolved:

```json
{ "mlproj": {
    "format": "0.1",
    "code":   "my-app",
    "title":  "My project",
    "connect": {
        "host":     "localhost",
        "user":     "admin",
        "password": "admin"
    },
    "servers": [{
        "name": "my-app",
        "type": "http",
        "port": "8099",
        "root": "/",
        "content": {
		    "name": "my-app-content"
		},
        "modules": {
		    "name": "my-app-modules"
		}
    }]
}
```

Note like the properties for the server have been merged from both files.  Note
as well that `${port}` is resolved to the parameter with that name with the
highest import precedence (in the importing file), even though it is used in
another file (in the imported file).

**Code**

The `code` is a short code, containing only ASCII alphanumeric characters (as
well as `-` and `_`).  It is typically used to refer to the project, and to
build component names in a consistent way (for databases, forests and servers).

**Title**

The `title` is a short, human-friendly description of the project.  It can use
Markdown notation (the notation used in Github).

**Description**

The `desc` is a longer description of the project than the title.  It can use
Markdown notation.

**Sources dir**

`srcdir` contains the path to the directory with the sources of the project.
This property is generally set automatically, when used in a standard `XProject`
structure, as the directory `src/`.

It is sometimes useful to set it explicitly for either 1) represent a more
complex setup, or 2) still be able to use those files with a project with
another structure than the standard `XProject` structure.

**Connection info**

The `connect` contains connection information: the `user` name to use, its
`password`, as well as the `host` where MarkLogic is installed.

**Parameters**

This is a plain JSON object for you to create variables.  Parameters have a name
(the object property key) and a value (the corresponding object value).  Values
must be strings.

They can be referred to in other places of the files, by using the `${...}`
notation.  Anywhere in a string value, this notation is replaced by the actual
value of the parameter of that name.  Parameters can be "overriden" (assigned a
different value) in an importing file.

The notation `@{...}` (with an "at" sign instead of a "dollar" sign) do not use
parameters, but values comming from "standard" properties.  You can use the
following variable substitutions, referring to properties with the same name:

- `@{code}`
- `@{title}`
- `@{desc}`
- `@{srcdir}`
- `@{host}`
- `@{user}`
- `@{password}`

A typical use of `@{code}` is to construct component names, and parameters is to
capture variable parts like port numbers:

```json
{
    "name": "@{code}-server",
    "type": "http",
    "port": "${port}"
}
```

**Servers**

`servers` is an array of servers.  Servers look like the following:

```json
{
    "id":   "server",
    "name": "@{code}",
    "type": "http",
    "port": "${port}",
    "root": "/",
    "rewriter": "/plumbing/rewriter.sjs",
    "handler":  "/plumbing/errors.sjs",
    "content": {
        "name": "@{code}-content"
    },
    "modules": {
        "name": "@{code}-modules"
    }
}
```

The `id` is a unique ID used only in the environment files, to refer to servers.
The `name` is the name of the server, as it will be set on MarkLogic, and `type`
is its type (either `http`, `webdav`, `xdbc` or `odbc`).  `port` is the port
number to use for the server.

`root` is the root for modules (either on the file system, or on the modules
database if it is set).  `rewriter` is the path to the URL rewriter, and
`handler` to the error handler.

`content` and `modules` are resp. the content database and the modules database.
They can be either a full-fledged database description, or a reference to an
existing database description (using `idref` or `nameref`).

**Databases**

`databases` is an array of databases.  Anywhere you can have a database, you can
either have an actual database description, of a reference to a database by ID
or by name.  Databases look like the following:

```json
{
    "id":   "...",
    "name": "...",
    "forests": [
        "..."
    ],
    "schema": {
	   "idref": "..."
    },
    "security": {
	   "idref": "..."
    },
    "triggers": {
	   "nameref": "..."
    },
    "indexes": {
        "ranges": [{
            "type":      "string",
            "name":      "ape",
            "positions": false,
            "invalid":   "ignore"
        }, {
            "type":      "string",
            "name":      [ "bear", "cat" ],
            "positions": false,
            "invalid":   "ignore"
        }]
    },
    "lexicons": {
        "uri": false,
        "collection": true
    }
}
```

The `id` is a unique ID used only in the environment files, to refer to
databases (e.g. from a server, to be its modules database).  The `name` is the
name of the database, as it will be set on MarkLogic.

`forests` describes the forests attached to the database.  If it is an array,
its values must be strings, used as names for the forests.  It can also by a
number (must be a positive integer then, including zero), which gives the number
of forests to attach to the database.  The forest names are then derived from
the database name, by appending `-001`, `-002`, etc.

`schema`, `security` and `triggers` are resp. the database's Schema DB, Security
DB and Triggers DB.  As always, they can be either ID or name reference to an
existing database description, or be a full, embedded database description.

Range indexes can be set in the `ranges` array.  Each is an object with the
following properties (if there is `path` it is a path range index, if there is
`parent` it is an attribute range index, and if not it is an element range
index):

- `type`: the scalar type of the range index (`int`, `string`...)
- `positions`: a boolean, whether to save or not the range value positions
- `invalid`: what to do in case of invalid values: `reject` or `ignore`
- `colation`: the collation to use for the range index
- `name`: the local name of the element or attribute (only for element and
  attribute range indexes)
- `namespace`: the namespace URI of the element or attribute (only for element and
  attribute range indexes)
- `parent.name`: the local name of the parent element of the attribute (only for
  attribute range indexes)
- `parent.namespace`: the namespace URI of the parent element of the attribute
  (only for attribute range indexes)
- `path`: the path expression to use (only for path range indexes)

`lexicons.uri` and `lexicons.collection` set whether to maintain resp. a URI or
a collection lexicon for that database.

This is far from covering all aspects and all possible properties of databases,
forests and servers.  It is a work in progress.  The goal is to support all
properties supported by the Management API of MarkLogic.  If you need one that
is not supported yet, make sure to open an issue about it, so it moves to the
top of the list.

## TODO

- for `deploy`, send several files at once, one-by-one is way too slow
  (or even zip then all, insert it as a doc, and unzip them with eval endpoint)
- new command `load` to load data on databases
- new command `add` to add components, indexes, etc. by answering few questions
- new command `mlcp` to invoke MLCP with info from the environment files
- new command `test` to run tests from command line
- new command to install a XAR/XAW file
- new command to install a XAR/XAW from CXAN
- new command to publish to CXAN
- edit environment files from the Console
- word lexicons
- drive properties by configuration (on a property-by-property basis)
    - start with simple properties, like URI and collection lexicons
    - create two such arrays, in cmp.Database and cmp.Server
    - its names (in spaces and api, or JPath), default value, scalar or array?,
      is it "changeable"?, etc.
- allow changing a server port, as it restarts the instance
- add support for triggers in space files

Support the following scenario (e.g. for the EXPath ML Console):

```
# check values are correct (supported)
mlproj -e dev -h myvm -u admin -z -p port:8010 show

# setup the environment (supported)
mlproj -e dev -h myvm -u admin -z -p port:8010 setup

# deploy modules (supported)
mlproj -e dev -h myvm -u admin -z -p port:8010 deploy

# initialize the app (to support)
mlproj -e dev -h myvm -u admin -z -p port:8010 init
```

which could/should be made easier:

```
# install everything (setup + deploy + init) (to support)
mlproj -e dev -h myvm -u admin -z -p port:8010 install
```
