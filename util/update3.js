#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .demand('limit')
    .default('cursor', 0)
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var collections = require('island-collections');
var profiles = collections.profiles;
var Events = require('island-events').Events;

boots.start(function (client) {
  var events = new Events({db: client.db});

  Step(
    function () {
      var limit = Number(argv.limit);
      var cursor = Number(argv.cursor);
      client.db.Ascents.list({}, {limit: limit, skip: limit * cursor}, this);
    },
    function (err, docs) {
      boots.error(err);
      if (docs.length === 0) return this();
      client.db.fill(docs, 'Medias', 'parent_id', {inflate: {author: profiles.member}},
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
              key: [m.author.username, iutil.createId_32()].join('/'),
              author_id: m.author._id,
              parent_id: doc._id,
              created: m.created
            };

            // Create the post.
            client.db.Posts.create(props, {inflate: {author: profiles.member},
                force: {key: 1}}, function (err, post) {
              boots.error(err);

              Step(
                function () {

                  // Remove existing event.
                  client.db.Events.remove({action_id: m._id}, this);

                },
                function () {

                  // Create event for post.
                  events.publish('post', 'post.new', {
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
                          g: iutil.hash(post.author.primaryEmail || 'foo@bar.baz'),
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
                  client.db.Medias._update({_id: m._id},
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
      console.log('bye');
      process.exit(0);
    }
  );
});
