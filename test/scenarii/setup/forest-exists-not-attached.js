"use strict";

(function() {

    function test(runner, scenario, cmd, base) {
        return scenario.test(
            runner,
            base + '../environs/simple-hen/prod.json',
            cmd.SetupCommand,
            [
                scenario.dbProps('simple-hen-content'),
                scenario.forests([ 'simple-hen-content-001' ]),
                scenario.dbProps('simple-hen-modules'),
                scenario.forests([ 'simple-hen-modules-001' ]),
                scenario.ignore('Not found'), // as props
                scenario.ignore('OK'),        // create db content
                scenario.attachForest('simple-hen-content-001', 'simple-hen-content'),
                scenario.ignore('OK'),        // create db modules
                scenario.attachForest('simple-hen-modules-001', 'simple-hen-modules'),
                scenario.ignore('OK')         // create as
            ]);
    }

    module.exports = {
        test : test
    }
}
)();
