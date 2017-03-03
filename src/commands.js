"use strict";

(function() {

    const act = require('./action');
    const s   = require('./space');

    /*~
     * The base class/interface for commands.
     */
    class Command
    {
	constructor(project) {
	    this.project = project;
	}
	execute() {
	    throw new Error('Command.execute is abstract');
	}
    }

    /*~
     * Create a new project.
     */
    class NewCommand extends Command
    {
	constructor(platform, dir, abbrev, title, name, version, port) {
	    super();
	    this.platform = platform;
	    this.dir      = dir;
	    this.abbrev   = abbrev;
	    this.title    = title;
	    this.name     = name;
	    this.version  = version;
	    this.port     = port;
	}

	execute() {
	    var pf = this.platform;
	    pf.log('<CREATE NEW PROJECT HERE...>');
	    pf.log('xproject/project.xml with:');
	    pf.line(1, 'abbrev',   this.abbrev);
	    pf.line(1, 'title',    this.title);
	    pf.line(1, 'name',     this.name);
	    pf.line(1, 'version',  this.version);
	    pf.line(1, 'port',     this.port);
	    pf.line(1, 'dir',      this.dir);
	    pf.line(1, 'xproject', pf.resolve('xproject',    this.dir));
	    pf.line(1, 'ml dir',   pf.resolve('xproject/ml', this.dir));

	    var xpdir = pf.resolve('xproject',    this.dir);
	    var mldir = pf.resolve('ml',          xpdir);
	    var proj  = pf.resolve('project.xml', xpdir);
	    var base  = pf.resolve('base.json',   mldir);
	    var dev   = pf.resolve('dev.json',    mldir);
	    var prod  = pf.resolve('prod.json',   mldir);
	    pf.mkdir(xpdir);
	    pf.mkdir(mldir);

	    pf.write(proj,
`<project xmlns="http://expath.org/ns/project"
         name="${ this.name }"
         abbrev="${ this.abbrev }"
         version="${ this.version }">

   <title>${ this.title }</title>

</project>
`);

	    pf.write(base,
`{
    "mlproj": {
        "format": "0.1",
        "params": {
            "port": "${ this.port }"
        },
        "databases": [{
	    "id": "content",
	    "name": "@{code}-content"
	}],
        "servers": [{
	    "id": "app",
            "name": "@{code}",
            "type": "http",
            "port": "\${port}",
            "content": {
                "idref": "content"
            }
        }]
    }
}
`);

	    pf.write(dev,
`{
    "mlproj": {
        "format": "0.1",
        "import": "base.json",
        "connect": {
            "host": "localhost",
            "user": "admin",
            "password": "admin"
        }
    }
}
`);

	    pf.write(prod,
`{
    "mlproj": {
        "format": "0.1",
        "import": "base.json",
        "connect": {
            "host": "prod.server",
            "user": "admin",
            "password": "admin"
        },
        "databases": [{
	    "id": "modules",
	    "name": "@{code}-modules"
	}],
        "servers": [{
	    "id": "app",
            "modules": {
                "idref": "modules"
            },
	    "root": "/"
        }]
    }
}
`);
	}
    }

    /*~
     * Display the resolved space.
     */
    class ShowCommand extends Command
    {
	execute() {
	    var pf    = this.project.platform;
	    var space = this.project.space;
	    var components = comps => {
		comps.forEach(c => {
		    c.show(pf);
		    pf.log('');
		});
	    };
	    pf.log('');
	    this.showProject(pf);
	    this.showEnviron(pf);
	    components(space.databases());
	    components(space.servers());
	}

	showProject(pf) {
	    var p = this.project;
	    pf.log(pf.bold('Project') + ': ' + pf.bold(pf.yellow(p.space.param('@code'))));
	    p.title   && pf.line(1, 'title',   p.title);
	    p.name    && pf.line(1, 'name',    p.name);
	    p.version && pf.line(1, 'version', p.version);
	    pf.log('');
	}

	showEnviron(pf) {
	    var space = this.project.space;
	    const imports = (space, level) => {
		space._imports.forEach(i => {
		    pf.line(level, '-> ' + i.href);
		    imports(i.space, level + 1);
		});
	    };
	    var mods;
	    try {
		mods = space.modulesDb().name;
	    }
	    catch (e) {
		if ( /no server/i.test(e.message) ) {
		    // nothing
		}
		else if ( /more than 1/i.test(e.message) ) {
		    mods = '(more than 1 server)';
		}
		else if ( /no modules/i.test(e.message) ) {
		    mods = '(filesystem)';
		}
		else {
		    throw e;
		}
	    }
	    pf.log(pf.bold('Environment') + ': '
		   + pf.bold(pf.yellow(this.project.environ || this.project.path)));
	    [ 'title', 'desc', 'host', 'user' ].forEach(p => {
		var v = space.param('@' + p);
		v && pf.line(1, p, v);
	    });
	    space.param('@password') && pf.line(1, 'password', '*****');
	    pf.line(1, 'sources dir', space.param('@srcdir'));
	    mods && pf.line(1, 'modules DB', mods);
	    var params = space.params();
	    if ( params.length ) {
		pf.line(1, 'parameters:');
		params.forEach(p => pf.line(2, p, space.param(p)));
	    }
	    if ( space._imports.length ) {
		pf.line(1, 'import graph:');
		imports(space, 2);
	    }
	    pf.log('');
	}
    }

    /*~
     * Create the components from the space on MarkLogic.
     */
    class SetupCommand extends Command
    {
	execute()
	{
	    var pf    = this.project.platform;
	    var space = this.project.space;
	    pf.log('--- ' + pf.bold('Prepare') + ' ---');
	    // the action list
            this.actions = new act.ActionList(pf);
	    var impl = comps => {
		if ( comps.length ) {
		    comps[0].setup(this.actions, () => impl(comps.slice(1)));
		}
		else {
		    doit();
		}
	    };
	    var doit = () => {
		pf.log('\n--- ' + pf.bold('Progress') + ' ---'
		       + (pf.dry ? ' (' + pf.red('dry run, not for real') + ')' : ''));
		this.actions.execute(summary);
	    };
            var summary = () => {
		pf.log('\n--- ' + pf.bold('Summary') + ' ---'
		       + (pf.dry ? ' (' + pf.red('dry run, not for real') + ')' : ''));
		this.actions.summary();
            };
	    var dbs  = space.databases();
	    var srvs = space.servers();
	    impl(dbs.concat(srvs));
        }
    }

    /*~
     * Deploy sources in a modules database.
     */
    class DeployCommand extends Command
    {
	execute() {
	    var pf    = this.project.platform;
	    var space = this.project.space;
	    var db    = space.modulesDb();
	    var dir   = space.param('@srcdir');
	    var files = pf.allFiles(dir, f => {
		return f.name[f.name.length - 1] !== '~';
	    }, f => {
		// DEBUG: ...
		pf.log('Ignored file: ' + f.path);
	    });
            this.actions = new act.ActionList(pf);
	    files.forEach(f => {
		var uri = f.slice(dir.length - 1);
		var doc = pf.read(f);
		this.actions.add(new act.DocInsert(db, uri, doc));
	    });
            this.actions.execute(() => {
		// TODO: Display errors if any...
		// And actions not done...
	    });
	}
    }

    module.exports = {
        NewCommand    : NewCommand,
        ShowCommand   : ShowCommand,
        SetupCommand  : SetupCommand,
        DeployCommand : DeployCommand
    }
}
)();
