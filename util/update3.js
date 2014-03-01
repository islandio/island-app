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
    .demand('limit')
    .demand('cursor')
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
var profiles = require('../lib/resources').profiles;
var PubSub = require('../lib/pubsub').PubSub;

boots.start({index: argv.index}, function (client) {
  var pubsub = new PubSub();

  Step(
    function () {
      var limit = Number(argv.limit);
      var cursor = Number(argv.cursor);
      db.Ascents.list({}, {limit: limit, skip: limit * cursor}, this);
    },
    function (err, docs) {
      boots.error(err);
      if (docs.length === 0) return this();
      db.fill(docs, 'Medias', 'parent_id', _.bind(function (err) {
        boots.error(err);

        var _this = _.after(docs.length, this);
        _.each(docs, function (doc) {
          if (doc.medias.length === 0) return _this();
          
          var __this = _.after(doc.medias.length, _this);
          _.each(doc.medias, function (m) {
            db.Medias._update({_id: m._id}, {
              $set: {
                ascent_id: doc._id,
                crag_id: doc.crag_id,
                country_id: doc.country_id
              },
              $unset: {parent_id: 1}
            }, __this);
          });
          
        });

      }, this));
    },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
});
