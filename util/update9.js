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
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');

boots.start(function (client) {

  Step(
    function () {
      client.db.Medias.list({'video.link': {$exists: 1}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        Step(
          function () {
            client.db.Posts.read({_id: d.parent_id}, this);
          },
          function (err, post) {
            boots.error(err);
            
            var body = '';
            if (d.video.link.type === 'vimeo') {
              body = 'https://vimeo.com/';
            } else if (d.video.link.type === 'youtube') {
              body = 'https://www.youtube.com/watch?v='
            }
            body += d.video.link.id;
            client.db.Posts._update({_id: post._id}, {$set: {body: body}}, this);
            client.db.Medias.remove({_id: d._id}, this.parallel());
          },
          _this
        );
      });
    },

    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );
});
