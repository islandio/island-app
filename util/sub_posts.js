#!/usr/bin/env node
/*
 * .js:
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
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('./boots');
var db = require('../lib/db.js');
var resources = require('../lib/resources');
var PubSub = require('../lib/pubsub').PubSub;

boots.start({index: argv.index}, function (client) {

  var pubsub = new PubSub();

  db.Posts.list({}, {inflate: {author: resources.profiles.member}}, function (err, docs) {
    boots.error(err);

    Step(
      function () {
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          pubsub.subscribe(d.author, d, {style: 'watch', type: 'post'}, _this);
        });
      },
      function (err) {
        boots.error(err);
        process.exit(0);
      }
    );

  });
  
});
