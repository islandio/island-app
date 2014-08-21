#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('muri', 'MongoDB URI')
      .default('muri')
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
var db = require('../lib/db');
var com = require('../lib/common');

boots.start({muri: argv.muri}, function (client) {
  Step(
    function () {
      db.Ticks.list({}, {inflate: {session: {collection: 'session', '*': 1}}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.author_id) return _this();
        db.Ticks._update({_id: d._id}, {$set: {author_id: d.session.author_id}}, _this);
      });
    },

    function (err) {
      boots.error(err);
      db.Actions.list({}, {inflate: {session: {collection: 'session', '*': 1}}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.author_id) return _this();
        db.Actions._update({_id: d._id}, {$set: {author_id: d.session.author_id}}, _this);
      });
    },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
});
