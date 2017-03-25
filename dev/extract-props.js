"use strict";

const all   = require('./all-properties');
const props = require('../src/properties');

function className(obj)
{
    var clazz = obj.constructor.toString();
    var res   = /^class\s+(\S+)\s+/.exec(clazz);
    if ( ! res ) {
	throw new Error('Not an instance of a class: ' + obj);
    }
    return res[1];
}

function byPath(res, path, name)
{
    if ( ! res[path] ) {
	res[path] = [];
    }
    res[path].push(name);
}

function byName(res, path, name)
{
    if ( ! res[name] ) {
	res[name] = [];
    }
    res[name].push(path);
}

function accumulate(found, obj, path, res)
{
    if ( ! res ) {
	res = {};
    }
    var clazz = className(obj);
    switch ( clazz ) {
    case 'ConfigObject':
	Object.keys(obj.props).forEach(p => {
	    accumulate(found, obj.props[p], (path ? path + '.' + p : p), res);
	});
	break;
    case 'MultiArray':
	obj.items.forEach(item => {
	    accumulate(found, item.prop, path, res);
	});
	break;
    case 'ObjectArray':
	found(res, path + '[]', obj.name);
	break;
    case 'Boolean':
    case 'Enum':
    case 'Integer':
    case 'String':
	found(res, path, obj.name);
	break;
    case 'Ignore':
	// nothing
	break;
    default:
	throw new Error('Unknown class: ' + clazz);
    }
    return res;
}

// export to a simplistic text format
function exportText()
{
    const padding = '                                   '; // 35 whitespaces

    const display = (found, obj) => {
	var res = accumulate(found, obj);
	Object.keys(res).sort().forEach(p => {
	    var left = p + ': ';
	    var pad  = padding.slice(left.length);
	    console.log(left + pad + res[p]);
	});
    };

    console.log('# db props');
    display(byName, props.database);
    console.log('# srv props');
    display(byName, props.server);
    console.log('# db paths');
    display(byPath, props.database);
    console.log('# srv paths');
    display(byPath, props.server);
}

// export to a HTML table
// if `ignore` is thruly, ignore not supoprted properties
function exportTable(ignore)
{
    const display = (obj, all) => {
	console.log('<table class="table">');
	console.log('<thead>');
	console.log('<tr><th>name</th><th>path</th></tr>');
	console.log('</thead>');
	console.log('<tbody>');
	var res = accumulate(byName, obj);
	// quick hack
	res['database-name']     = [ 'name' ];
	res['forest']            = [ 'forests' ];
	res['schema-database']   = [ 'schema' ];
	res['security-database'] = [ 'security' ];
	res['triggers-database'] = [ 'triggers' ];
	res['server-name']       = [ 'name' ];
	// TODO: Detect `res` props that are not in `all`, and generate an error
	// for unknown property...
	all.forEach(p => {
	    if ( ! ignore ) {
		console.log('<tr>'
			    + '<td>' + p + '</td>'
			    + '<td>' + (res[p] ? res[p] : '✗') + '</td>'
			    + '</tr>');
	    }
	});
	console.log('</tbody>');
	console.log('</table>');
    };

    console.log('<h4>Database properties</h4>');
    console.log('<p>Supported properties for databases.</p>');
    display(props.database, all.dbProps);
    console.log('<h4>Server properties</h4>');
    console.log('<p>Supported properties for servers.</p>');
    display(props.server, all.srvProps);
}

// exportText();
exportTable();
// exportTable(true);
