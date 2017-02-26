# mlproj

Project and environment manager for MarkLogic.

This is work in progress.  Use at your own risks.

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
> mlproj --help

  Usage: mlproj [options] [command]


  Commands:

    debug   log the given environment
    setup   setup the given environment

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -d, --dry             dry run
    -e, --environ <name>  environment name
    -f, --file <file>     environment file
    -v, --verbose         verbose mode
```

As for now, the only command is `setup`.  It creates databases, forests and
servers as described in environment files (or adapt them if they already exist
and  changes have been made to the environment files).

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

**TODO**: Describe the format...

Examples of environment files can be found in
the [test/spaces/](http://github.com/fgeorges/mlproj/tree/master/test/spaces)
directory.

## TODO

- publish on npmjs
    - https://www.npmjs.com/package/mlproj
    - https://docs.npmjs.com/getting-started/publishing-npm-packages
    - http://blog.npmjs.org/post/118810260230/

- word lexicons
- drive properties by configuration (on a property-by-property basis)
    - start with simple properties, like URI and collection lexicons
    - create two such arrays, in cmp.Database and cmp.Server
    - its names (in spaces and api, or JPath), default value, scalar or array?,
      is it "changeable"?, etc.
- allow changing a server port, as it restarts the instance
