"use strict";

(function() {

    const cmd   = require('./commands');
    const space = require('./space');

    module.exports = {
        Platform      : space.Platform,
        NewCommand    : cmd.NewCommand,
        ShowCommand   : cmd.ShowCommand,
        SetupCommand  : cmd.SetupCommand,
        LoadCommand   : cmd.LoadCommand,
        DeployCommand : cmd.DeployCommand
    }
}
)();
