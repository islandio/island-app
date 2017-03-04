#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
var boots = require('island-boots');

boots.start(function (client) {

  Step(
    function () {
      client.db.Sessions._update({}, {$unset: {weather: 1}}, {multi: true}, this);
    },
    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );
});
