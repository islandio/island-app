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
      client.db.Posts.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        client.db.Medias._update({parent_id: d._id}, {$set: {parent_type: 'post'}},
            {multi: true}, _this);
      });
    },
    
    function (err) {
      boots.error(err);
      client.db.Ticks.list({}, this);
    },

    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        client.db.Medias._update({parent_id: d._id}, {$set: {parent_type: 'tick'}},
            {multi: true}, _this);
      });
    },

    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );

});
