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

var membersIndexed = 0;
var postsIndexed = 0;
var cragsIndexed = 0;
var ascentsIndexed = 0;

boots.start(function (client) {

  Step(
    function () {
      console.log('Indexing members');

      // Get all members.
      client.db.Members.list({}, this.parallel());
      client.cache.del('members-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();

      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        membersIndexed += client.cache.index('members', d,
            ['displayName', 'userName'], _this);
        membersIndexed += client.cache.index('members', d, ['displayName'],
            _this, {strategy: 'noTokens'});
      });
    },
    function (err) {
      boots.error(err);
      console.log('Indexing crags');

      // Get all crags.
      client.db.Crags.list({}, this.parallel());
      client.cache.del('crags-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        cragsIndexed += client.cache.index('crags', d, ['name'], _this);
        cragsIndexed += client.cache.index('crags', d, ['name'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);
      console.log('Indexing posts');

      // Get all posts.
      client.db.Posts.list({}, this.parallel());
      client.cache.del('posts-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d) {
        // Add new.
        postsIndexed += client.cache.index('posts', d, ['title'], _this);
        postsIndexed += client.cache.index('posts', d, ['title'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);
      console.log('Indexing ascents');

      // Get all ascents.
      client.db.Ascents.list({}, this.parallel());
      client.cache.del('ascents-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      var next = this;

      if (docs.length === 0) return this();
      var iter = 0;

      var run100 = function () {
        for (var i = iter;i < (iter + 100) && i < docs.length; i++) {
          ascentsIndexed += client.cache.index('ascents', docs[i], ['name'],
              function (err) { step(err, i) });
        }
      };

      var step = function(err, i) {
        if (err) { boots.error(err); process.exit(0) }
        else if (i === docs.length) { next(); }
        else if (i === iter + 100) {
          if (i % 30000 === 0) console.log(iter/docs.length * 100 + '%');
          iter = i;
          run100();
        }
        else {}
      };

      run100();
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed members, ascents, crags, and posts');
      util.log('Members entries: ' + membersIndexed);
      util.log('Posts entries: ' + postsIndexed);
      util.log('Crags entries: ' + cragsIndexed);
      util.log('Ascents entries: ' + ascentsIndexed);
      process.exit(0);
    }
  );

});
