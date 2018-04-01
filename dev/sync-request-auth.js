const crypto  = require('crypto');
const request = require('sync-request');

function md5(name, str) {
    let res = crypto.createHash('md5').update(str).digest('hex');
    return res;
}

function parseDigest(header)
{
    if ( ! header || header.slice(0, 7) !== 'Digest ' ) {
        throw new Error('Expect WWW-Authenticate for digest, got: ' + header);
    }
    return header.substring(7).split(/,\s+/).reduce((obj, s) => {
        var parts = s.split('=')
        obj[parts[0]] = parts[1].replace(/"/g, '')
        return obj
    }, {});
}

function renderDigest(params)
{
    const attr = (key, quote) => {
        if ( params[key] ) {
            attrs.push(key + '=' + quote + params[key] + quote);
        }
    };
    var attrs = [];
    attr('username',  '"');
    attr('realm',     '"');
    attr('nonce',     '"');
    attr('uri',       '"');
    attr('algorithm', '');
    attr('response',  '"');
    attr('opaque',    '"');
    attr('qop',       '');
    attr('nc',        '');
    attr('cnonce',    '"');
    return 'Digest ' + attrs.join(', ');
}

function authenticate(method, path, header, username, password)
{
    var params = parseDigest(header);
    if ( ! params.qop ) {
        throw new Error('Not supported: qop is unspecified');
    }
    else if ( params.qop === 'auth-int' ) {
        throw new Error('Not supported: qop is auth-int');
    }
    else if ( params.qop === 'auth' ) {
        // keep going...
    }
    else {
        if ( params.qop.split(/,/).includes('auth') ) {
            // keep going...
            params.qop = 'auth';
        }
        else {
            throw new Error('Not supported: qop is ' + params.qop);
        }
    }
    // TODO: Handle NC and CNONCE
    var nc     = '00000001';
    var cnonce = '4f1ab28fcd820bc5';
    var ha1    = md5('ha1', username + ':' + params.realm + ':' + password);
    var ha2    = md5('ha2', method + ':' + path);
    var resp   = md5('response', [ha1, params.nonce, nc, cnonce, params.qop, ha2].join(':'));
    var auth   = {
        username:  username,
        realm:     params.realm,
        nonce:     params.nonce,
        uri:       path,
        qop:       params.qop,
        response:  resp,
        nc:        nc,
        cnonce:    cnonce,
        opaque:    params.opaque,
        algorithm: params.algorithm
    };
    return renderDigest(auth);
};

function test(name, user, pwd, method, path, header)
{
    console.log();
    console.log('** TEST ' + name + ' **');
    var auth = authenticate(method, path, header, user, pwd);
    // console.log('** HEADER:');
    // console.log(header);
    // console.log('** AUTH:');
    // console.log(auth);
    return auth;
}

function test_real(name, user, pwd, method, path, host)
{
    // variables
    const url      = 'http://' + host + path;
    const options  = {
        url: url,
        headers: {
            accept: 'application/json'
        }
    };
    // 1st request
    var resp   = request(method, url, options);
    console.log('** RESPONSE I:');
    console.log(resp);
    // authenticate
    var header = resp.headers['www-authenticate'];
    var auth   = test(name + '+', user, pwd, method, path, header);
    options.headers.authorization = auth;
    console.log('** OPTIONS:');
    console.log(options);
    // 2d request
    resp = request(method, url, options);
    console.log('** RESPONSE II:');
    console.log(resp);
    // authenticate again if asked for
    header = resp.headers['www-authenticate'];
    if ( header ) {
        auth = test(name + '++', user, pwd, method, path, header);
        options.headers.authorization = auth;
        console.log('** OPTIONS:');
        console.log(options);
        // 3d request
        resp = request(method, url, options);
        console.log('** RESPONSE III:');
        console.log(resp);
    }
    return auth;
}

// a real one
function test_001()
{
    const path = '/manage/v2/databases/simple-ape-content/properties';
    test_real('001', 'admin', 'admin', 'GET', path, 'ml911:8002');
}

// from https://en.wikipedia.org/wiki/Digest_access_authentication
// expected:
// Digest username="Mufasa",
//     realm="testrealm@host.com",
//     nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093",
//     uri="/dir/index.html",
//     qop=auth,
//     nc=00000001,
//     cnonce="0a4f113b",
//     response="6629fae49393a05397450978507c4ef1",
//     opaque="5ccc069c403ebaf9f0171e9517f40e41"
// comutations:
//    HA1 = MD5( "Mufasa:testrealm@host.com:Circle Of Life" )
//        = 939e7578ed9e3c518a452acee763bce9
//    HA2 = MD5( "GET:/dir/index.html" )
//        = 39aff3a2bab6126f332b942af96d3366
//    Response = MD5( "939e7578ed9e3c518a452acee763bce9:\
//                     dcd98b7102dd2f0e8b11d0f600bfb0c093:\
//                     00000001:0a4f113b:auth:\
//                     39aff3a2bab6126f332b942af96d3366" )
//             = 6629fae49393a05397450978507c4ef1
function test_002()
{
    const header = `Digest realm="testrealm@host.com",
                        qop="auth,auth-int",
                        nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093",
                        opaque="5ccc069c403ebaf9f0171e9517f40e41"`;
    test('002', 'Mufasa', 'Circle Of Life', 'GET', '/dir/index.html', header);
}

// from a real one
// computed the expected response manually
function test_003()
{
    const header = `Digest realm="public",
                        qop="auth",
                        nonce="3cb26ae30abd5b2ae29e7ff858315fc5",
                        opaque="c89f29dc554c81ad"`;
    test('003', 'admin', 'admin', 'GET', '/', header);
}

// a real one
function test_004()
{
    const path = '/digest-auth/auth/admin/admin';
    test_real('004', 'admin', 'admin', 'GET', path, 'httpbin.org');
}

// from a real one to httpbin.org from the browser (succesful)
// computed the expected response manually
function test_005()
{
    const header = `Digest nonce="22fb20e71cb4b1471fcaafd860bf5926",
                        qop="auth",
                        opaque="8a45663438d37fce69f530be8db9e704",
                        realm="me@kennethreitz.com",
                        algorithm=MD5`;
    test('005', 'in', 'in', 'GET', '/digest-auth/auth/in/in', header);
}

test_001();
// test_002();
// test_003();
// test_004();
// test_005();
