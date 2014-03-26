#!/usr/bin/env node
/*
 * index_posts.js: Index all Island posts by title.
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
var profiles = require('../lib/resources').profiles;

boots.start(function (client) {

  var search = reds.createSearch('posts');
  search.client = client;

  db.Posts.list({}, {inflate: {author: profiles.member}},
      function (err, docs) {
    boots.error(err);

    Step(
      function () {
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {

          Step(
            function () {
              if (d.title && d.title !== '')
                if (d.title.match(/\w+/g))
                  search.index(d.title, d._id.toString(), this);
                else this();
              else this();
            },
            // function (err) {
            //   boots.error(err);
            //   if (d.author.displayName && d.author.displayName !== ''
            //     && d.author.displayName.match(/\w+/g))
            //     search.index(d.author.displayName, d._id.toString(), this);
            //   else this();
            // },
            // function (err) {
            //   boots.error(err);
            //   if (d.author.username && d.author.username !== '')
            //     if (d.author.username.match(/\w+/g))
            //       search.index(d.author.username, d._id.toString(), this);
            //     else this();
            //   else this();
            // },
            function (err) {
              boots.error(err);
              _this();
            }
          );
  
        });
      },
      function (err) {
        boots.error(err);
        process.exit(0);
      }
    );

  });
  
});
