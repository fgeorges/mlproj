const fs  = require('fs');
const xml = require('xml2js');

var parser = new xml.Parser();

const path = '../../datasets/xproject/project.xml';

fs.readFile(path, (err, data) => {
    parser.parseString(data, (err, result) => {
        console.dir(result);
        console.log('Done');
    });
});

// fs.mkdirSync('/tmp/fubar');

// console.log(process.cwd());
