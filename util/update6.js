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
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');

boots.start(function (client) {
  Step(

    function () {
      client.db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.primaryEmail === null) {
          client.db.Members._update({_id: d._id}, {$unset: {
            primaryEmail: 1
          }}, _this);
        } else {
          _this();
        }
      });
    },
    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );
});
