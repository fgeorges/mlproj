#!/usr/bin/env node

"use strict";

const test    = require('../lib/unit-test').test;
const program = require('../../../src/program');

function fxLoadSimple()
{
    // global options:
    //
    //     -d, --dry, --dry-run
    //     -p, --param   <name:value>
    //     -e, --environ <environ>
    //     -f, --file    <file>
    //
    // global usage:
    //
    //     mlproj [-d] [-e environ|-f file] cmd [args...]
    //
    // load options:
    //
    //     -a, --as,  --server     <server>
    //     -b, --db,  --database   <database>
    //     -s, --src, --source-set <sourceset>
    //     -/, --dir, --directory  <directory>
    //     -d, --doc, --document   <document>
    //
    // load usage:
    //
    //     load [-a server|-b database] [-s sourceset|-/ directory|-d document|what]

    let prg = new program.Program();
    prg
        .version('0.23.0test')
        .flag('dry',   '-d', '--dry', '--dry-run', 'flag dry')
        .map( 'param', '-p', '--param',            'map params')
        .or()
            .option('environ', '-e', '--environ', 'option environ')
            .option('file',    '-f', '--file',    'option file')
            .end();
    prg
        .command('load')
        .or()
            .option('server',   '-a', '--as', '--server',   'option load.server')
            .option('database', '-b', '--db', '--database', 'option load.database')
            .end()
        .or()
            //.option('sourceset', '-s', '--src', '--source-set', 'option load.sourceset')
            .option('directory', '-/', '--dir', '--directory',  'option load.directory')
            .option('documents', '-d', '--doc', '--document',   'option load.documents')
            .arg('what')
            .end();
    return prg;
}

function fxRealApp()
{
    let prg = new program.Program();

    prg
        .version('0.23.0test')
        .option('code',     '-c', '--code',             'set/override the @code')
        .flag(  'dry',      '-d', '--dry', '--dry-run', 'dry run')
        .option('host',     '-h', '--host',             'set/override the @host')
        .map(   'param',    '-p', '--param',            'set/override a parameter value <name:value>')
        .option('user',     '-u', '--user',             'set/override the @user')
        .flag(  'verbose',  '-v', '--verbose',          'verbose mode')
        .flag(  'password', '-z', '--password',         'ask for password interactively')
        .or()
            .option('environ', '-e', '--environ', 'environment name')
            .option('file',    '-f', '--file',    'environment file')
            .end();

    prg
        .command('help')
        .arg('cmd');

    prg
        .command('new');

    prg
        .command('show');

    prg
        .command('setup');

    prg
        .command('load')
        .or()
            .option('server',   '-a', '--as', '--server',   'server, get its content database')
            .option('database', '-b', '--db', '--database', 'target database')
            .end()
        .or()
            //.option('sourceset', '-s', '--src', '--source-set', 'source set to load')
            .option('directory', '-/', '--dir', '--directory',  'directory to load')
            .option('documents', '-1', '--doc', '--document',   'file to load')
            .arg('what')
            .end();

    prg
        .command('deploy')
        .or()
            .option('server',   '-a', '--as', '--server',   'server, get its modules database')
            .option('database', '-b', '--db', '--database', 'target database')
            .end()
        .or()
            //.option('sourceset', '-s', '--src', '--source-set', 'source set to deploy')
            .option('directory', '-/', '--dir', '--directory',  'directory to deploy')
            .option('documents', '-1', '--doc', '--document',   'file to deploy')
            .arg('what')
            .end();

    return prg;
}

test('Simple happy load', ass => {
    ass.jsonObject(
        'Happy load with global and local args',
        fxLoadSimple().parse(['-e', 'env', 'load', '-b', 'content', 'data']),
        {
            global: {
                environ: 'env'
            },
            cmd: 'load',
            local: {
                database: 'content',
                what: 'data'
            }
        }
    );
});

test('Simple happy load with params', ass => {
    ass.jsonObject(
        'Load with one param',
        fxLoadSimple().parse(['-p', 'hello:world', 'load']),
        {
            global: {
                param: {
                    hello: 'world'
                }
            },
            cmd: 'load',
            local: {}
        }
    );
    ass.jsonObject(
        'Load with several params',
        fxLoadSimple().parse(['-p', 'hello:world', '-p', 'bonjour:monde', 'load']),
        {
            global: {
                param: {
                    hello: 'world',
                    bonjour: 'monde'
                }
            },
            cmd: 'load',
            local: {}
        }
    );
});

test('Exclusive options', ass => {
    ass.error(
        'Given both global environ and file',
        () => fxLoadSimple().parse(['-e', 'env', '-f', 'path', 'load']),
        'Arg environ already set, exclusif with: file');
    ass.error(
        'Given both local database and server',
        () => fxLoadSimple().parse(['load', '-b', 'content', '--server', 'app']),
        'Arg database already set, exclusif with: server');
});

test('Real app examples', ass => {
    ass.jsonObject(
        'Happy deploy with global and local args',
        fxRealApp().parse([
            '--param', 'a:b',
            '--code', 'fb',
            '-p', 'c=d',
            '-e', 'env',
            '-p', 'e:f',
            'deploy',
            '-a', 'app',
            'foo/bar'
        ]),
        {
            global: {
                code: 'fb',
                environ: 'env',
                param: {
                    a: 'b',
                    c: 'd',
                    e: 'f'
                }
            },
            cmd: 'deploy',
            local: {
                server: 'app',
                what: 'foo/bar'
            }
        }
    );
});
