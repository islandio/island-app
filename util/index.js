#!/usr/bin/env node
/*
 * index.js: Index all users, datasets, views, and channels for search.
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
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var com = require('../lib/common');


boots.start({redis: true}, function (client) {

  // Create searches.
  reds.client = client.redisClient;
  var searches = {
    users: reds.createSearch('users'),
    datasets: reds.createSearch('datasets'),
    views: reds.createSearch('views'),
    channels: reds.createSearch('channels')
  };

  Step(
    function () {

      // Get all datasets.
      db.Datasets.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.datasets.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.datasets, d, ['title', 'source', 'tags'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      // Get all views.
      db.Views.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.views.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.views, d, ['name', 'tags'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      // Get all users.
      db.Users.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.users.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.users, d, ['displayName', 'username'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      // Get all channels.
      db.Channels.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.channels.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.channels, d, ['humanName'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed users, datasets, views, and channels');
      process.exit(0);
    }
  );

});
