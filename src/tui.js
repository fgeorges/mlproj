#!/usr/bin/env node

"use strict";

const program = require('commander');
const lib     = require('./lib');
const cmd     = require('./commands');

var resolved = false;
var commands = [
    new cmd.SetupCommand()
];

program
    .version('0.0.1')
    //.option('-x, --xxx <path>', 'some global option');

commands.forEach(cmd => {
    var prg = program
        .command(cmd.command())
        .description(cmd.description());
    cmd.options().forEach(opt => {
        prg = prg.option(opt.option, opt.label) });
    prg.action(function(path) {
        resolved = true;
        try {
            cmd.prepare(path);
            cmd.execute();
        }
        catch ( err ) {
            console.warn(lib.red('Error') + ': ' + err.message);
        }
    });
});

program.parse(process.argv);

if ( ! resolved ) {
    program.help();
}
