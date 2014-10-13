#!/usr/bin/env node
/*
 * index.js: Index all ascents, members, crags, and posts for search.
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
var db = require('../lib/db');

var membersIndexed = 0;
var postsIndexed = 0;
var cragsIndexed = 0;
var ascentsIndexed = 0;

boots.start({redis: true, muri: argv.muri}, function (client) {

  var cache = client.cache;

  Step(
    function () {

      // Get all members.
      db.Members.list({}, this.parallel());
      cache.del('members-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();

      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        membersIndexed += cache.index('members', d, ['displayName', 'userName'],
            _this);
        membersIndexed += cache.index('members', d, ['displayName'],
            _this, {strategy: 'noTokens'});
      });
    },
    function (err) {
      boots.error(err);

      // Get all crags.
      db.Crags.list({}, this.parallel());
      cache.del('crags-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        cragsIndexed += cache.index('crags', d, ['name'], _this);
        cragsIndexed += cache.index('crags', d, ['name'], {strategy: 'noTokens'},
            _this);
      });
    },
    /*
     *  woah, this takes forever
    function (err) {
      boots.error(err);

      // Get all ascents.
      db.Ascents.list({}, this.parallel());
      cache.del('ascents-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d, idx) {
        // Add new.
        ascentsIndexed += cache.index('ascents', d, ['name'],
            _this);
      });
    },
    */
    function (err) {
      boots.error(err);

      // Get all posts.
      db.Posts.list({}, this.parallel());
      cache.del('posts-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d) {
        // Add new.
        postsIndexed += cache.index('posts', d, ['title'], _this);
        postsIndexed += cache.index('posts', d, ['title'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed ascents, members, crags, and posts');
      util.log('Members entries: ' + membersIndexed);
      util.log('Posts entries: ' + postsIndexed);
      util.log('Crags entries: ' + cragsIndexed);
      util.log('Ascents entries: ' + ascentsIndexed);
      process.exit(0);
    }
  );

});
