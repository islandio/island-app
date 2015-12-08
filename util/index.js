#!/usr/bin/env node
/*
 * index.js: Index all members, posts, crags, and ascents for search.
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
var queue = require('queue-async');

var membersIndexed, postsIndexed, cragsIndexed, ascentsIndexed;

var requestIndex = function(client, type, docs, keys, cb) {
  if (docs.length === 0) return cb(null, 0);
  var q = queue(25);
  var fcn = _.bind(client.cache.index, client.cache);
  _.each(docs, function(d) {
    q.defer(fcn, type, d, keys)
  });
  q.awaitAll(function(err, res) {
    var idxed = _.reduce(res, function(m, r) {
      return m + r;
    }, 0);
    cb(err, idxed);
  });
};

boots.start(function (client) {

  Step(
    function () {
      console.log('Indexing members');

      // Get all members.
      client.db.Members.list({}, this.parallel());
      client.cache.del('members-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);
      requestIndex(client, 'members', docs, ['username', 'displayName'], this);
    },
    function (err, count) {
      boots.error(err);
      membersIndexed = count;
      console.log('Indexing crags');

      // Get all crags.
      client.db.Crags.list({}, this.parallel());
      client.cache.del('crags-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);
      requestIndex(client, 'crags', docs, ['name', 'country'], this);
    },
    function (err, count) {
      boots.error(err);
      cragsIndexed = count;
      console.log('Indexing posts');

      // Get all posts.
      client.db.Posts.list({}, this.parallel());
      client.cache.del('posts-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);
      requestIndex(client, 'posts', docs, ['title'], this);
    },
    function (err, count) {
      boots.error(err);
      postsIndexed = count;
      console.log('Indexing ascents');

      // Get all ascents.
      client.db.Ascents.list({}, this.parallel());
      client.cache.del('ascents-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);
      requestIndex(client, 'ascents', docs, ['name'], this);
    },
    function (err, count) {
      boots.error(err);
      ascentsIndexed = count;
      util.log('Redis: Indexed members, ascents, crags, and posts');
      util.log('Members entries: ' + membersIndexed);
      util.log('Posts entries: ' + postsIndexed);
      util.log('Crags entries: ' + cragsIndexed);
      util.log('Ascents entries: ' + ascentsIndexed);
      process.exit(0);
    }
  );

});
