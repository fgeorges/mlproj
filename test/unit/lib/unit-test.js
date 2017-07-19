"use strict";

// TODO: This lib is (almost) duplicated in mlproj-core, do we want to change that?

(function() {

    const mockery = require('mockery');
    mockery.enable({
        warnOnUnregistered: false
    });
    // requires mlproj-core to be cloned next to mlproj...
    mockery.registerSubstitute('mlproj-core', '../../mlproj-core/index.js');

    const chalk = require('chalk');

    function success(msg) {
        console.log(chalk.green('✔') + ' ' + msg);
    }

    function fail(msg) {
        console.log(chalk.red('✘') + ' ' + msg);
    }

    class Assert
    {
        constructor() {
            this.failures = [];
        }

        fail(msg) {
            this.failures.push({ msg: msg });
        }

        jsonObject(msg, actual, expected) {
            if ( Array.isArray(actual) ) {
                if ( ! Array.isArray(expected) ) {
                    this.fail(msg + ': got an array, should got: ' + typeof expected);
                }
                else if ( actual.length !== expected.length ) {
                    this.fail(msg + ': arrays of different lengths: ' + actual.expected + '/' + expected.length);
                }
                else {
                    actual.forEach((act, i) => {
                        let exp = expected[i];
                        if ( (typeof act) === 'object' ) {
                            this.jsonObject(msg, act, exp);
                        }
                        else if ( act !== exp ) {
                            this.fail(msg + ': array members differ at ' + i + ': ' + act + ' / ' + exp);
                        }
                    });
                }
            }
            else if ( (typeof actual) === 'object' ) {
                if ( (typeof expected) !== 'object' ) {
                    this.fail(msg + ': got an object, should got: ' + typeof expected);
                }
                else {
                    let lhs = Object.keys(actual).sort();
                    let rhs = Object.keys(expected).sort();
                    if ( lhs.length !== rhs.length ) {
                        this.fail(msg + ': object of different keys: ' + lhs + ' / ' + rhs);
                    }
                    else {
                        for ( let same = true, i = 0; same && i < lhs.length; ++i ) {
                            let key = lhs[i];
                            if ( key !== rhs[i] ) {
                                this.fail(msg + ': object of different keys: ' + lhs + ' / ' + rhs);
                            }
                            else {
                                let act = actual[key];
                                let exp = expected[key];
                                if ( (typeof act) === 'object' ) {
                                    this.jsonObject(msg, act, exp);
                                }
                                else if ( act !== exp ) {
                                    this.fail(msg + ': object entries differ at ' + key + ': ' + act + ' / ' + exp);
                                }
                            }
                        }
                    }
                }
            }
            else {
                this.fail(msg + ': only objects are allowed: ' + typeof actual);
            }
        }

        error(msg, fun, expected) {
            try {
                fun();
                this.fail(msg + ': should throw the error: ' + expected);
            }
            catch ( err ) {
                if ( err.message !== expected ) {
                    this.fail(msg + ': the error message should be: ' + expected);
                }
            }
        }
    }

    function test(desc, fun) {
        let ass = new Assert();
        // TODO: Catch errors...
        fun(ass);
        if ( ass.failures.length ) {
            fail(desc);
            ass.failures.forEach(f => {
                console.log('    - ' + f.msg);
            });
        }
        else {
            success(desc);
        }
    }

    module.exports = {
        test : test
    }
}
)();
