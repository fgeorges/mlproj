# mlproj

Project and environment manager for MarkLogic.

All details on: http://mlproj.org/.

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

Use `mlproj help` for an overview.  Go to http://mlproj.org/ for all details.

## TODO

** New command: `generate` or something like that, to create a new component,
but just on the screen (`create` sounds good actually, as opposed to `add`):

    $ mlproj create rewriter > plumbing/rewriter.xml
    Add the URI of the rewriter to you app server, using the property
    "rewriter", so it looks something like the following:
    
        "servers": [{
            "name":     "@{code}",
            "rewriter": "/plumbing/rewriter.xml"
        }]

**SOURCES** (keep them path relative to proj dir?, or CWD in case of -f)

- ADD TESTS...! (for all items below...)
- 
- support sources as is (only includes/excludes), in new and load
- wrap file path list generation (filtering, all that)
- add support for garbage (w/ default value)
- add support for @defaults
- test @defaults in xproject/mlproj.json and ~/.mlproj.json
- 
- adapt watch to use the same filtering...
- add URI calculation support (decl. (root, prefix...) + function)
- link sources to databases and servers
- 
- add support for filter
- add support for feeder
- add URI calculation support (decl. (root, prefix...) + function)
- add way to link to a JS file + function name (for filter, feeder, and uri)

Before code/functions, make it possible to serialize space files back.

Needs refactoring, difference between space (file) and environ (includes
resolution through imports, Spaces store JSON, Environ components, etc.)

So create class Environ, with a set of Spaces, move resolution functions from
Space to Environ, and keep a clean separation between both classes.

Then write a serialization function which is deterministic, human-friendly and
stable.  Use it in command new as well.


In commands.js:
// ************
// - Move these NEW_*() to files in a sub-dir, and load them.
// - Transform them to give them a chance to inject some data,
//   asked for on the command line.
// - Use different sub-dirs for different scaffoldings.
// ************

- maintain the file extensions (and their types) in the project file
- allow command `new` to create projects with different scaffoldings
  - using "embedded" scaffoldings (empty, plain, complete, annotated, web, rest...)
  - using "remotes" ones (on Git repos?)
  - `new` can even create such scaffolding templates
  - and they can be `publish`ed in a gallery
  - complete examples for outreach, or real operational scaffoldings
- new command `add` to add components, indexes, etc. by answering few questions
- new command `mlcp` to invoke MLCP with info from the environment files
- new command `test` to run tests from command line
- new command to install a XAR/XAW file
- new command to install a XAR/XAW from CXAN
- new command to publish to CXAN
- edit environment files from the Console
- word lexicons
- add support for triggers in environs
- add confirmation level for deploy, load, setup, etc.
  (so ask for confirmation for TEST, and for extra critical red-alert-level
  confirmation for PROD...)

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
