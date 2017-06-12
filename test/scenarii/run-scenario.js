#!/usr/bin/env node

"use strict";

const mockery = require('mockery');
mockery.enable({
    warnOnUnregistered: false
});
// requires mlproj-core to be cloned next to mlproj...
mockery.registerSubstitute('mlproj-core', '../../mlproj-core/index.js');

const chalk    = require('chalk');
const fs       = require('fs');
const scenario = require('./lib/scenario');
//const cmd      = require('../../src/commands');
const core     = require('mlproj-core');

var tests = [];
if ( process.argv.length === 2 ) {
    [ 'setup' ].forEach(dir => addDir(tests, dir));
}
else if ( process.argv.length !== 3 ) {
    console.log('Must have exactly one option (the path to the scenario file to run)');
    process.exit(1);
}
else if ( isDir(process.argv[2]) ) {
    addDir(tests, process.argv[2]);
}
else {
    tests.push(process.argv[2]);
}

function isScenario(path) {
    return path.endsWith('.js');
}

function isDir(path) {
    return fs.statSync(path).isDirectory();
}

function addDir(tests, dir) {
    if ( dir.endsWith('/') ) {
        dir = dir.slice(0, dir.length - 1);
    }
    fs.readdirSync(dir).forEach(f => {
        var p = dir + '/' + f;
        if ( isDir(p) ) {
            addDir(tests, p);
        }
        else if ( isScenario(p) ) {
            tests.push(p);
        }
    });
}

// TODO: Move the lib/scenario.js functions in this class.
// Simplifies the interface of tests, they receive just the runner object.
//
class TestRunner
{
    constructor() {
        this.nextIdx = 0;
        this.history = [];
    }

    calls(calls) {
        this.calls = calls;
    }

    nextCall() {
        return this.calls[this.nextIdx++];
    }

    progress(verb, api, url, data) {
        // push this call in history
        var hist = {
            verb : verb,
            api  : api,
            url  : url
        };
        if ( data ) {
            hist.data = data;
        }
        this.history.push(hist);
        // log this call
        // TODO: Make it depends on a "verbose" flag
        if ( false ) {
            console.log('Send ' + verb + ' on ' + api + ' at ' + url);
        }
    }

    fail(call, msg) {
        // TODO: Create a flag "verbose", or "info", or "debug"
        //
        // console.log(chalk.red('FAIL') + ': ' + msg);
        // console.dir(call);
        // console.log('Call history so far:');
        // console.dir(this.history);
        var err = new Error(msg);
        err.expected = call;
        err.actual   = this.history[this.history.length - 1];
        throw err;
    }
}

var failures = [];
tests.forEach(test => {
    try {
        var t = test;
        if ( t[0] !== '.' ) {
            t = './' + t;
        }
        // require(t).test(new TestRunner(), scenario, cmd, './');
        require(t).test(new TestRunner(), scenario, core, './');
        console.log(chalk.green('✔') + ' ' + test);
    }
    catch ( err ) {
        console.log(chalk.red('✘') + ' ' + test);
        // test failure
        if ( err.expected ) {
            failures.push({
                test     : test,
                msg      : err.message,
                expected : err.expected,
                actual   : err.actual
            });
        }
        // any other error
        else {
            failures.push({
                test : test,
                err  : err
            });
        }
    }
});

console.log();
if ( failures.length ) {
    console.log('Some scenario failed.');
}
else {
    console.log('All scenarii passed!');
}
console.log();
failures.forEach(f => {
    if ( f.err ) {
        console.log(chalk.red('Error') + ': ' + f.test);
        console.log(f.err);
    }
    else {
        console.log(chalk.red('Failure') + ': ' + f.test);
        console.log(f.msg);
    }
    console.log();
});
