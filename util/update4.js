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
var profiles = require('../lib/resources').profiles;
var PubSub = require('../lib/pubsub').PubSub;

boots.start({index: argv.index}, function (client) {
  var pubsub = new PubSub();

  Step(

    function () {
      db.Posts.list({}, {inflate: {author: profiles.member}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (doc) {
        db.Events.read({action_id: doc._id}, function (err, e) {
          boots.error(err);
          if (e) return _this();

          pubsub.publish('post', 'post.new', {
            data: doc,
            event: {
              actor_id: doc.author._id,
              target_id: null,
              action_id: doc._id,
              action_type: 'post',
              data: {
                action: {
                  i: doc.author._id.toString(),
                  a: doc.author.displayName,
                  g: com.hash(doc.author.primaryEmail || 'foo@bar.baz'),
                  t: 'post',
                  b: _.prune(doc.body, 40),
                  n: doc.title,
                  s: doc.key
                }
              }
            }
          }, _this);

        });
      });
    },

    function (err) {
      boots.error(err);
      db.Medias.list({ascent_id: {$exists: 1}}, {inflate: {
        author: profiles.member,
        ascent: {collection: 'ascent', '*': 1}
      }}, this);
    },
    function (err, docs) {
      boots.error(err);
      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (doc) {
        db.Events.read({action_id: doc._id}, function (err, e) {
          boots.error(err);
          if (e) return _this();

          pubsub.publish('media', 'media.new', {
            data: doc,
            event: {
              actor_id: doc.author._id,
              target_id: doc.ascent._id,
              action_id: doc._id,
              action_type: 'media',
              data: {
                action: {
                  i: doc.author._id.toString(),
                  a: doc.author.displayName,
                  g: com.hash(doc.author.primaryEmail || 'foo@bar.baz'),
                  t: 'media',
                  b: doc.type
                },
                target: {
                  t: 'ascent',
                  n: doc.ascent.name,
                  w: doc.ascent.crag,
                  s: ['crags', doc.ascent.key].join('/')
                }
              }
            }
          }, _this);

        });
      });
    },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
});
