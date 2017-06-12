"use strict";

// Dev notes and implementation of the database dependency resolution
// algorithm.  It creates a linear array of database objects, which
// can be created in that order, given a set of databases and servers
// JSON objects from the space files.

const fs = require('fs');

// to be run from `../`: `node dev/dp-deps.js`
var json = JSON.parse(fs.readFileSync('test/spaces/simple-dog/prod.json', 'utf8'));

class Database {
    constructor(name, id, schemas, security) {
        if ( ! name ) {
            throw new Error('No name!');
        }
        this.name     = name;
        this.id       = id;
        this.schemas  = schemas  === 'self' ? this : schemas;
        this.security = security === 'self' ? this : security;
    }
}

class Server {
    constructor(name, id, content, modules) {
        if ( ! name ) {
            throw new Error('No name!');
        }
        this.name    = name;
        this.id      = id;
        this.content = content;
        this.modules = modules;
    }
}

var dbs   = [];
var ids   = {};
var names = {};

function instantiate(json) {
    var id      = json.id;
    var name    = json.name;
    var resolve = db => {
        if ( ! db ) {
            return;
        }
        var res = ( db.name && names[db.name] )
            || ( db.nameref && names[db.nameref] )
            || ( db.id && ids[db.id] )
            || ( db.idref && ids[db.idref] );
        if ( res ) {
            return res;
        }
        // is it self-referencing by ID?
        if ( db.idref && db.idref === json.id ) {
            return 'self';
        }
        // is it self-referencing by name?
        if ( db.nameref && db.nameref === json.name ) {
            return 'self';
        }
    };
    var db = new Database(name, id, resolve(json.schemas), resolve(json.security));
    dbs.push(db);
    if ( id ) {
        ids[id] = db;
    }
    if ( name ) {
        names[name] = db;
    }
    return db;
}

function done(db) {
    if ( ! db ) {
        // no dependency
        return true;
    }
    else if ( db.id && ids[db.id] ) {
        // has an ID and has been done
        return true;
    }
    else if ( db.name && names[db.name] ) {
        // has a name and has been done
        return true;
    }
    else if ( db.idref && ids[db.idref] ) {
        // is a reference to an ID that has been done
        return true;
    }
    else if ( db.nameref && names[db.nameref] ) {
        // is a reference to a name that has been done
        return true;
    }
    else {
        return false;
    }
}

function selfRef(parent, child) {
    if ( ! child ) {
        return false;
    }
    else if ( parent.id && parent.id === child.idref ) {
        return true;
    }
    else if ( parent.name && parent.name === child.nameref ) {
        return true;
    }
    else {
        return false;
    }
}

function isRef(db) {
    if ( ! db ) {
        return false;
    }
    else if ( db.idref || db.nameref ) {
        return true;
    }
    else {
        return false;
    }
}

function candidates(db) {
    if ( done(db) ) {
        return [];
    }
    else if ( isRef(db) ) {
        if ( ( db.idref && ids[db.idref] ) || ( db.nameref && names[db.nameref] ) ) {
            return [ db ];
        }
        else {
            return [];
        }
    }
    else {
        var sch = selfRef(db, db.schemas)  || done(db.schemas);
        var sec = selfRef(db, db.security) || done(db.security);
        if ( sch && sec ) {
            return [ db ];
        }
        else {
            return candidates(db.schemas)
                .concat(candidates(db.security));
        }
    }
}

var databases = json.mlproj.databases;
var servers   = json.mlproj.servers;

function allCandidates() {
    var res = [];
    databases.forEach(db => {
        res = res.concat(candidates(db));
    });
    servers.forEach(srv => {
        res = res.concat(candidates(srv.content));
        res = res.concat(candidates(srv.modules));
    });
    return res;
}

function unsolved() {
    var impl = (db) => {
        if ( done(db) ) {
            return [];
        }
        else {
            return [ db ]
                .concat(impl(db.schemas))
                .concat(impl(db.security));
        }
    };
    var res  = [];
    var srvs = [];
    databases.forEach(db => {
        res = res.concat(impl(db));
    });
    servers.forEach(srv => {
        var lhs = impl(srv.content);
        var rhs = impl(srv.modules);
        if ( lhs.length || rhs.length ) {
            srvs.push(srv);
        }
        res = res.concat(lhs).concat(rhs);
    });
    return res.concat(srvs);
}

function linearize() {
    for ( var add = allCandidates(); add.length; add = allCandidates() ) {
        add.forEach(instantiate);
    }
    var leftover = unsolved();
    if ( leftover.length ) {
        var disp = leftover.map(c => {
            if ( c.content || c.modules ) {
                return '{srv ' + (c.name || '') + '}';
            }
            else if ( c.id || c.name ) {
                return '{db ' + (c.id || '') + '|' + (c.name || '') + '}';
            }
            else {
                return '{dbref ' + (c.idref || '') + '|' + (c.nameref || '') + '}';
            }
        });
        throw new Error('Some components have unsolved database dependencies: ' + disp);
    }
}

linearize();

console.log(dbs);

var srvs = servers.map(srv => {
    var resolve = db => {
        if ( ! db ) {
            return;
        }
        return ( db.name && names[db.name] )
            || ( db.nameref && names[db.nameref] )
            || ( db.id && ids[db.id] )
            || ( db.idref && ids[db.idref] );
    };
    return new Server(srv.name, srv.id, resolve(srv.content), resolve(srv.modules));
});

console.log(srvs);
