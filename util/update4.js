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
      client.db.Posts.list({}, {inflate: {author: profiles.member}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (doc) {
        client.db.Events.read({action_id: doc._id}, function (err, e) {
          boots.error(err);
          if (e) return _this();

          events.publish('post', 'post.new', {
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
                  g: iutil.hash(doc.author.primaryEmail || 'foo@bar.baz'),
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
      console.log('bye');
      process.exit(0);
    }
  );
});
