#!/usr/bin/env node
/*
 * index.js: Index all member, posts, crags, ascents for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('muri', 'MongoDB URI')
      .default('muri', 'mongodb://localhost:27017/island')
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

boots.start({redis: true, muri: argv.muri}, function (client) {

  // Create searches.
  reds.client = client.redisClient;
  var searches = {
    members: reds.createSearch('members'),
    posts: reds.createSearch('posts'),
    crags: reds.createSearch('crags'),
    ascents: reds.createSearch('ascents')
  };

  Step(
    function () {

      // Get all members.
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.members.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.members, d, ['displayName', 'username'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      // Get all posts.
      db.Posts.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.posts.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.posts, d, ['title'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      // Get all crags.
      db.Crags.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        // Remove existing index.
        searches.crags.remove(d._id, function (err) {
          boots.error(err);

          // Add new.
          com.index(searches.crags, d, ['name'], _this);
        });
      });
    },
    function (err) {
      boots.error(err);

      var cursor = 0;
      (function do100() {
        db.Ascents.list({}, {limit: 100, skip: 100 * cursor},
            function (err, docs) {
          boots.error(err);

          Step(
            function () {
              if (docs.length === 0) return this();
              var _this = _.after(docs.length, this);
              _.each(docs, function (d) {

                // Remove existing index.
                searches.ascents.remove(d._id, function (err) {
                  boots.error(err);

                  // Add new.
                  com.index(searches.ascents, d, ['name'], _this);
                });
              });
            },
            function (err) {
              boots.error(err);
              if (docs.length < 100)
                process.exit(0);
              else {
                ++cursor;
                do100();
              }
            }
          );
        });
      })();
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed members, posts, crags, and ascents');
      process.exit(0);
    }
  );

});
