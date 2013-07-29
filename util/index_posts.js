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
var boots = require('./boots');
var db = require('../lib/db.js');

boots.start(function (client) {

  var search = reds.createSearch('posts');
  search.client = client;

  db.Posts.list({}, function (err, docs) {
    boots.error(err);

    Step(
      function () {
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          if (d.title && d.title !== '')
            if (d.title.match(/\w+/g))
              search.index(d.title, d._id.toString());
          _this();
        });
      },
      function (err) {
        boots.error(err);
        process.exit(0);
      }
    );

  });
  
});
