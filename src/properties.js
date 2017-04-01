"use strict";

(function() {

    const act = require('./action');

    class ConfigObject
    {
        constructor(type) {
            this._type       = type;
            this.props       = {};
            this.mandatories = {};
            this.defaults    = {};
            this.frozen      = {};
        }

        type(type) {
            this._type = type + '.' + this._type;
            Object.keys(this.props).forEach(p => this.props[p].type(type));
        }

        add(path, mandatory, prop) {
            if ( this.props[path] !== undefined ) {
                throw new Error('Property already configured: ' + path);
            }
            this.props[path] = prop;
            if ( mandatory ) {
                this.mandatories[path] = prop;
            }
            prop.type(this._type);
            return this;
        }

        dflt(path, val) {
            if ( this.defaults[path] !== undefined ) {
                throw new Error('Property default already configured: ' + path);
            }
            if ( this.mandatories[path] !== undefined ) {
                throw new Error('Cannot have default for a mandatory property: ' + path);
            }
            this.defaults[path] = val;
            return this;
        }

        freeze(path) {
            if ( this.frozen[path] !== undefined ) {
                throw new Error('Property already frozen: ' + path);
            }
            this.frozen[path] = true;
            return this;
        }

        parse(config, result) {
            // do not provide any when calling top-level
            if ( ! result ) {
                result = {};
            }
            // extract values
            Object.keys(config).forEach(cfg => {
                var prop = this.props[cfg];
                if ( ! prop ) {
                    throw new Error('Unknwon config property: ' + this._type + '.' + cfg);
                }
                var value = config[cfg];
                if ( value !== null ) {
                    prop.handle(result, value, cfg);
                }
            });
            // chack mandatory properties
            this.ensure(result);
            // add the default values
            Object.keys(this.defaults).forEach(dflt => {
                if ( config[dflt] === undefined ) {
                    var prop  = this.props[dflt];
                    var value = this.defaults[dflt];
                    if ( 'function' === typeof value ) {
                        value = value(result);
                    }
                    prop.handle(result, value, dflt);
                }
            });
            // return it
            return result;
        }

        ensure(result) {
            Object.keys(this.mandatories).forEach(p => {
                var prop = this.mandatories[p];
                if ( prop instanceof Ignore ) {
                    // nothing
                }
                else if ( prop instanceof ConfigObject ) {
                    prop.ensure(result);
                }
                else if ( ! Object.keys(result).find(res => res === prop.name) ) {
                    throw new Error('Mandatory config prop ' + this._type + '.' + prop.name + ' not set');
                }
            });
        }

        handle(result, value, key) {
            // recurse parsing
            this.parse(value, result);
        }
    }

    class Ignore
    {
        handle() {
            // ignore
        }

        type() {
            // ignore
        }
    }

    class Database
    {
        constructor(name) {
            this.name = name;
        }

        handle(result, value, key) {
            console.log('TODO: implement Database.handle(): ' + this.name + ' / ' + key);
        }

        type() {
            console.log('TODO: implement Database.type(): ' + this.name + ' / ' + key);
        }
    }

    class MultiArray
    {
        constructor() {
            this.items = [];
        }

        add(pred, item) {
            this.items.push({
                pred: pred,
                prop: item
            });
            return this;
        }

        type(type) {
            this.items.forEach(item => {
                item.prop.type(type);
            });
        }

        handle(result, value, key) {
            for ( var i = 0; i < value.length; ++i ) {
                var v = value[i];
                var k = 0;
                var item;
                do {
                    item = this.items[k++];
                }
                while ( k < this.items.length && ! item.pred(v) );
                if ( item ) {
                    item.prop.handle(result, v, key);
                }
                else {
                    throw new Error('No predicate matches the value in multi array: ' + key);
                }
            }
        }
    }

    class ObjectArray
    {
        constructor(name, label, prop) {
            this.name  = name;
            this.label = label;
            this.prop  = prop;
        }

        type(type) {
            this.prop.type(type);
        }

        handle(result, value, key) {
            if ( ! result[this.name] ) {
                result[this.name] = new Result(this, []);
            }
            var r     = this.prop.parse(value);
            var all   = [];
            var multi = Object.keys(this.prop.props).filter(p => {
                return this.prop.props[p] instanceof Multiplexer;
            });
            if ( multi.length === 0 ) {
                all.push(r);
            }
            else if ( multi.length === 1 ) {
                var name = this.prop.props[multi[0]].name;
                var val  = r[name].value;
                if ( Array.isArray(val) ) {
                    val.forEach(v => {
                        var o = {};
                        Object.keys(r).filter(n => n !== name).forEach(n => o[n] = r[n]);
                        o[name] = new Result(r[name].prop, v);
                        all.push(o);
                    });
                }
                else {
                    all.push(r);
                }
            }
            else {
                throw new Error('Several multiplexer in the same object not supported');
            }
            all.forEach(one => result[this.name].value.push(one));
        }

        compare(lhs, rhs) {
            if ( ! Array.isArray(lhs) ) {
                throw new Error('lhs is not an array');
            }
            if ( ! Array.isArray(rhs) ) {
                throw new Error('rhs is not an array');
            }
            if ( lhs.length !== rhs.length ) {
                return false;
            }
            var found = true;
            for ( var l = 0; l < lhs.length && found; ++l ) {
                found = false;
                var left   = lhs[l];
                var lprops = Object.keys(left).sort();
                for ( var r = 0; r < rhs.length && ! found; ++r ) {
                    var right  = rhs[r];
                    var rprops = Object.keys(right).sort();
                    if ( lprops.length === rprops.length ) {
                        var equal  = true;
                        for ( var i = 0; i < lprops.length && equal; ++i ) {
                            var name = lprops[i];
                            equal = ( rprops[i] === name )
                                && ( left[name] === right[name] );
                        }
                        found = equal;
                    }
                }
            }
            return found;
        }
    }

    // used as a marker on one of the ConfigObject of an ObjectArray
    class Multiplexer
    {
        constructor(prop) {
            this.prop = prop;
            this.name = prop.name;
        }

        handle(result, value, key) {
            this.prop.handle(result, value, key);
        }

        type(type) {
            this.prop.type(type);
        }
    }

    class Result
    {
        constructor(prop, value, type, frozen) {
            this.prop   = prop;
            this.value  = value;
            this._type  = type;
            this.frozen = frozen;
        }

        show(pf, level) {
            if ( ! level ) {
                level = 1;
            }
            if ( Array.isArray(this.value) ) {
                this.value.forEach(v => {
                    pf.line(level, this.prop.label);
                    Object.keys(v).forEach(n => v[n].show(pf, level + 1));
                });
            }
            else {
                pf.line(level, this.prop.label, this.value);
            }
        }

        create(obj) {
            obj[this.prop.name] = this.value;
        }

        rawValue() {
            var val = this.value;
            if ( Array.isArray(this.value) ) {
                val = [];
                this.value.forEach(item => {
                    var obj = {};
                    Object.keys(item).forEach(p => obj[p] = item[p].rawValue());
                    val.push(obj);
                });
            }
            return val;
        }

        update(actions, body, comp, logger) {
            var val = this.rawValue();
            if ( ! this.prop.compare(val, body[this.prop.name]) ) {
                if ( this.frozen ) {
                    throw new Error('Property differ but is frozen on ' + comp.name + ': ' + this.prop.name);
                }
                logger(actions, 1, 'update', this.prop.label);
                if ( 'database' === this._type ) {
                    actions.add(new act.DatabaseUpdate(comp, this.prop.name, val));
                }
                else if ( 'server' === this._type ) {
                    actions.add(new act.ServerUpdate(comp, this.prop.name, val));
                }
                else {
                    throw new Error('Unsupported component type: ' + this._type);
                }
            }
        }
    }

    class Simple
    {
        constructor(name, label) {
            this.name   = name;
            this.label  = label;
            this.frozen = false;
        }

        freeze() {
            this.frozen = true;
            return this;
        }

        handle(result, value, key) {
            if ( result[this.name] !== undefined ) {
                throw new Error('Property already exists: ' + this.name);
            }
            result[this.name] = new Result(this, this.value(value), this._type, this.frozen);
        }

        compare(lhs, rhs) {
            return lhs === rhs;
        }

        type(type) {
            if ( this._type ) {
                throw new Error('Type already set on ' + this.name + ': ' + this._type);
            }
            this._type = type;
        }
    }

    class Enum extends Simple
    {
        constructor(name, label, values) {
            super(name, label);
            this.values = values;
        }

        value(val) {
            if ( ! this.values.includes(val) ) {
                throw new Error('Invalid value ' + val + ' in enum ' + this.name + ': ' + this.values);
            }
            return val;
        }
    }

    class Boolean extends Simple
    {
        constructor(name, label) {
            super(name, label);
        }

        value(val) {
            var type = typeof val;
            if ( 'boolean' === type ) {
                // great, nothing to do
            }
            else if ( 'string' === type ) {
                if ( 'false' === val ) {
                    val = false;
                }
                else if ( 'true' === val ) {
                    val = true;
                }
                else {
                    throw new Error('Invalid boolean value: ' + val);
                }
            }
            else {
                throw new Error('Boolean value neither a string or a boolean: ' + type);
            }
            return val;
        }
    }

    class Integer extends Simple
    {
        constructor(name, label) {
            super(name, label);
        }

        value(val) {
            var type = typeof val;
            if ( 'number' === type ) {
                if ( ! Number.isInteger(val) ) {
                    throw new Error('Integer value is a non-integer number: ' + val);
                }
            }
            else if ( 'string' === type ) {
                if ( ! /^[0-9]+$/.test(val) ) {
                    throw new Error('Not a lexically valid integer value: ' + val);
                }
                val = Number.parseInt(val, 10);
            }
            else {
                throw new Error('Integer value neither a string or a number: ' + type);
            }
            return val;
        }
    }

    class String extends Simple
    {
        constructor(name, label) {
            super(name, label);
        }

        value(val) {
            return val;
        }
    }

    // same base for 3 types of range indexes, below
    function rangeBase() {
        return new ConfigObject(/*'db.range'*/)
            .add('type',      true,  new String('scalar-type',           'type'))
            .add('positions', false, new String('range-value-positions', 'positions'))
            .add('invalid',   false, new   Enum('invalid-values',        'invalid', [ 'ignore', 'reject' ]))
            .add('collation', false, new String('collation',             'collation'))
            .dflt('collation', res => {
                return res['scalar-type'].value === 'string'
                    ? 'http://marklogic.com/collation/'
                    : '';
            });
    }

    // the database properties and config format
    var database = new ConfigObject('database')
        .add('compose',  false, new Ignore())
        .add('comment',  false, new Ignore())
        .add('id',       false, new Ignore())
        .add('name',     true,  new Ignore())
        .add('forests',  false, new Ignore())
        // .add('schema',   false, new Database('schema-database'))
        // .add('security', false, new Database('security-database'))
        // .add('triggers', false, new Database('triggers-database'))
        .add('schema',   false, new Ignore())
        .add('security', false, new Ignore())
        .add('triggers', false, new Ignore())
        .add('indexes',  false, new ConfigObject(/*'db.indexes'*/)
             .add('ranges', false, new MultiArray()
                  .add(item => item.path, new ObjectArray('range-path-index', 'path range index', rangeBase()
                       .add('path',      true,  new String('path-expression', 'path'))))
                  .add(item => item.parent, new ObjectArray('range-element-attribute-index', 'attribute range index', rangeBase()
                       .add('name',      true,  new Multiplexer(new String('localname', 'name')))
                       .add('namespace', false, new String('namespace-uri', 'ns'))
                       .add('parent',    true,  new ConfigObject(/*'db.parent'*/ undefined, 'parent')
                            .add('name',      true,  new String('parent-localname',     'name'))
                            .add('namespace', false, new String('parent-namespace-uri', 'ns'))
                            .dflt('namespace', ''))
                       .dflt('namespace', '')))
                  .add(item => true, new ObjectArray('range-element-index', 'element range index', rangeBase()
                       .add('name',      true,  new Multiplexer(new String('localname', 'name')))
                       .add('namespace', false, new String('namespace-uri', 'ns'))
                       .dflt('namespace', '')))))
        .add('searches', false, new ConfigObject(/*'db.indexes'*/)
             .add('fast', false, new ConfigObject()
                  .add('case-sensitive',            false, new Boolean('fast-case-sensitive-searches',            'fast case sensitive searches'))
                  .add('diacritic-sensitive',       false, new Boolean('fast-diacritic-sensitive-searches',       'fast diacritic sensitive searches'))
                  .add('element-character',         false, new Boolean('fast-element-character-searches',         'fast element character searches'))
                  .add('element-phrase',            false, new Boolean('fast-element-phrase-searches',            'fast element phrase searches'))
                  .add('element-trailing-wildcard', false, new Boolean('fast-element-trailing-wildcard-searches', 'fast element trailing wildcard searches'))
                  .add('element-word',              false, new Boolean('fast-element-word-searches',              'fast element word searches'))
                  .add('phrase',                    false, new Boolean('fast-phrase-searches',                    'fast phrase searches'))
                  .add('reverse',                   false, new Boolean('fast-reverse-searches',                   'fast reverse searches'))))
        .add('lexicons', false, new ConfigObject(/*'db.lexicons'*/)
             .add('uri',        false, new Boolean('uri-lexicon',        'URI lexicon'))
             .add('collection', false, new Boolean('collection-lexicon', 'collection lexicon')));

    // the server properties and config format
    var server = new ConfigObject('server')
        .add('compose',  false, new Ignore())
        .add('comment',  false, new Ignore())
        .add('id',       false, new Ignore())
        .add('name',     true,  new Ignore())
        .add('group',    false, new Ignore())
        // .add('content',  true,  new Database('content-database'))
        // .add('modules',  false, new Database('modules-database'))
        .add('content',  true,  new Ignore())
        .add('modules',  false, new Ignore())
        .add('type',     true,  new     Enum('server-type',   'type', [ 'http' ]).freeze())
        .add('port',     true,  new  Integer('port',          'port').freeze())
        .add('root',     false, new   String('root',          'root'))
        .add('rewriter', false, new   String('url-rewriter',  'url rewriter'))
        .add('handler',  false, new   String('error-handler', 'error handler'))
        .add('output',   false, new ConfigObject()
             .add('byte-order-mark',             false, new   Enum('output-byte-order-mark',             'output byte order mark',             [ 'yes', 'no', 'default' ]))
             .add('cdata-section-localname',     false, new String('output-cdata-section-localname',     'output cdata section localname'))
             .add('cdata-section-namespace-uri', false, new String('output-cdata-section-namespace-uri', 'output cdata section namespace uri'))
             .add('doctype-public',              false, new String('output-doctype-public',              'output doctype public'))
             .add('doctype-system',              false, new String('output-doctype-system',              'output doctype system'))
             .add('encoding',                    false, new   Enum('output-encoding',                    'output encoding', [
                 'UTF-8', 'ASCII', 'ISO-8859-1', 'ISO-8859-5', 'ISO-8859-6', 'ISO-2022-KR', 'ISO-2022-JP', 'EUC-CN', 'EUC-KR', 'EUC-JP', 'CP932',
                 'CP936', 'CP949', 'CP950', 'CP1252', 'CP1256', 'KOI8-R', 'GB12052', 'GB18030', 'GB2312', 'HZ-GB-2312', 'BIG5', 'BIG5-HKSCS', 'Shift_JIS' ]))
             .add('escape-uri-attributes',       false, new   Enum('output-escape-uri-attributes',       'output escape uri attributes',       [ 'yes', 'no', 'default' ]))
             .add('include-content-type',        false, new   Enum('output-include-content-type',        'output include content type',        [ 'yes', 'no', 'default' ]))
             .add('include-default-attributes',  false, new   Enum('output-include-default-attributes',  'output include default attributes',  [ 'yes', 'no', 'default' ]))
             .add('indent',                      false, new   Enum('output-indent',                      'output indent',                      [ 'yes', 'no', 'default' ]))
             .add('indent-tabs',                 false, new   Enum('output-indent-tabs',                 'output indent tabs',                 [ 'yes', 'no', 'default' ]))
             .add('indent-untyped',              false, new   Enum('output-indent-untyped',              'output indent untyped',              [ 'yes', 'no', 'default' ]))
             .add('media-type',                  false, new String('output-media-type',                  'output media type'))
             .add('method',                      false, new   Enum('output-method',                      'output method', [
                 'default', 'xml', 'xhtml', 'html', 'text', 'sparql-results-json', 'sparql-results-csv', 'n-triples', 'n-quads' ]))
             .add('normalization-form',          false, new   Enum('output-normalization-form',          'output normalization form',          [ 'none', 'NFC', 'NFD', 'NFKD' ]))
             .add('omit-xml-declaration',        false, new   Enum('output-omit-xml-declaration',        'output omit xml declaration',        [ 'yes', 'no', 'default' ]))
             .add('sgml-character-entities',     false, new   Enum('output-sgml-character-entities',     'output sgml character entities',     [ 'none', 'normal', 'math', 'pub' ]))
             .add('standalone',                  false, new   Enum('output-standalone',                  'output standalone',                  [ 'yes', 'no', 'omit' ]))
             .add('undeclare-prefixes',          false, new   Enum('output-undeclare-prefixes',          'output undeclare prefixes',          [ 'yes', 'no', 'default' ]))
             .add('version',                     false, new String('output-version',                     'output version')))

    module.exports = {
        database : database,
        server   : server,
        Result   : Result
    }
}
)();
