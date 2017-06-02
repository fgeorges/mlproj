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
                scenario.ignore('Not found'), // as props
                scenario.ignore('OK'),        // create db
                scenario.attachForest('simple-hen-content-001', 'simple-hen-content'),
                scenario.ignore('OK')         // create as
            ]);
    }

    module.exports = {
        test : test
    }
}
)();
