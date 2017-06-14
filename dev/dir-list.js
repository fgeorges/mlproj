const fs   = require('fs');
const path = require('path');

function allFilesSync_01(dir, filelist = []) {
    return fs.readdirSync(dir).map(file => {
        const p = path.join(dir, file);
        return fs.statSync(p).isDirectory()
            ? allFilesSync_01(p, filelist)
            : filelist.concat(p)[0];
    });
}

function allFilesSync_02(dir, filelist = {}) {
    fs.readdirSync(dir).forEach(file => {
        const p = path.join(dir, file);
        const f = filelist[file] = { path: p };
        if ( fs.statSync(p).isDirectory() ) {
            f.files = allFilesSync_02(p);
        }
    });
    return filelist;
}

function allFilesSync_04(dir)
{
    // extract the basename of the dir path in `p`
    const basename = p => {
        var idx = p.lastIndexOf('/');
        // no slash
        if ( idx < 0 ) {
            return p;
        }
        // slash at the end
        else if ( idx + 1 === p.length ) {
            var pen = p.lastIndexOf('/', idx - 1);
            // no other slash
            if ( pen < 0 ) {
                return p.slice(0, idx);
            }
            // take name between both slashes
            else {
                return p.slice(pen + 1, idx);
            }
        }
        // slash somewhere else
        else {
            return p.slice(idx + 1);
        }
    };

    // recursive implementation
    const impl = (dir, list) => {
        fs.readdirSync(dir).forEach(file => {
            const p = path.join(dir, file);
            const s = fs.statSync(p);
            // TODO: Do something with `s.isSymbolicLink()`?
            if ( ! (s.isBlockDevice() || s.isCharacterDevice() || s.isFIFO() || s.isSocket()) ) {
                const f = { name: file, path: p };
                list.push(f);
                if ( s.isDirectory() ) {
                    f.files = [];
                    impl(p, f.files);
                }
            }
        });
    };

    // only for a directory
    if ( ! fs.statSync(dir).isDirectory() ) {
        throw new Error('Can only list files of a directory: ' + dir);
    }

    // set the top-level infos, and call recursive implementation
    var res = {
        files: [],
        path : dir,
        name : basename(dir)
    };
    impl(dir, res.files);
    return res;
}

// and the winner is...
var allFilesSync = allFilesSync_04;

// all the files in `dir`
var dir   = 'test';
var files = allFilesSync(dir);

console.log(JSON.stringify(files));

// flaten the dirs/files into an array of file paths
function flaten(dir, list) {
    dir.files.forEach(f => {
        if ( f.files ) {
            flaten(f, list);
        }
        else {
            list.push(f.path);
        }
    });
}

var flat = [];
flaten(files, flat);
console.log('FLAT LIST:');
flat.forEach(f => console.log(f));
