#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('index', 'Ensure indexes on MongoDB collections')
      .boolean('index')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var redis = require('redis');
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var com = require('../lib/common');
var resources = require('../lib/resources');
var PubSub = require('../lib/pubsub').PubSub;

boots.start({index: argv.index}, function (client) {
  Step(

    function () {
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        db.Members._update({_id: d._id}, {$set: {
          'config.privacy': {mode: 0},
          'config.notifications.follow.email': true,
          'config.notifications.request.email': true
        }}, _this);
      });
    },
    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
});
