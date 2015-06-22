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
_.mixin(require('underscore.string'));
var boots = require('../boots');

boots.start(function (client) {

  Step(
    function () {
      client.db.Members._update({}, {$set: {prefs:
      {
        grades: {
          boulder: 'font',
          route: 'french'
        },
        units: 'si'
      }}}, {multi: true}, this);
    },

    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );

});
