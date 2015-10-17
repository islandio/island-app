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
var profiles = require('island-collections').profiles;

boots.start(function (client) {

  Step(
    function () {
      client.db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      console.log(['name', 'email'].join(','));

      docs.forEach(function(mem) {
        if (mem.primaryEmail) {
          console.log([(mem.displayName || mem.username).trim(),
              mem.primaryEmail].join(','));
        }
      });

      this();
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
