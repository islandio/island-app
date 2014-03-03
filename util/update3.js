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
    .default('cursor', 0)
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
      db.fill(docs, 'Medias', 'parent_id', {inflate: {author: profiles.member}},
          _.bind(function (err) {
        boots.error(err);

        var _this = _.after(docs.length, this);
        _.each(docs, function (doc) {
          if (doc.medias.length === 0) return _this();          
          var __this = _.after(doc.medias.length, _this);
          _.each(doc.medias, function (m) {

            // Post props.
            var props = {
              body: '',
              title: '',
              type: 'video',
              product: {
                sku: null,
                price: null,
                type: null,
                subtype: null,
              },
              key: [m.author.username, com.createId_32()].join('/'),
              author_id: m.author._id,
              parent_id: doc._id,
            };

            // Create the post.
            db.Posts.create(props, {inflate: {author: profiles.member},
                force: {key: 1}}, function (err, post) {
              boots.error(err);

              Step(
                function () {

                  // Remove existing event.
                  db.Events.remove({action_id: m._id}, this);

                },
                function () {

                  // Create event for post.
                  pubsub.publish('post', 'post.new', {
                    data: post,
                    event: {
                      actor_id: post.author._id,
                      target_id: doc._id,
                      action_id: post._id,
                      action_type: 'post',
                      data: {
                        action: {
                          i: post.author._id.toString(),
                          a: post.author.displayName,
                          g: com.hash(post.author.primaryEmail || 'foo@bar.baz'),
                          t: 'post',
                          b: _.prune(post.body, 40),
                          n: post.title,
                          s: post.key
                        },
                        target: {
                          t: 'ascent',
                          i: doc._id.toString(),
                          n: doc.name,
                          s: ['crags', doc.key].join('/')
                        }
                      }
                    }
                  }, this);
                },
                function (err) {
                  boots.error(err);

                  // Set media parent to post.
                  console.log(m._id, post._id, '..........................');
                  db.Medias._update({_id: m._id},
                      {$set: {parent_id_old: doc._id, parent_id: post._id}}, __this);
                }
              );

            });
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
