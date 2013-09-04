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
var db = require('../lib/db.js');
var com = require('../lib/common.js');
var resources = require('../lib/resources');
var PubSub = require('../lib/pubsub').PubSub;

boots.start({index: argv.index}, function (client) {

  var pubsub = new PubSub();

  Step(

    // function () {
    //   console.log('members update...');
    //   db.Members.list({}, this);
    // },
    // function (err, docs) {
    //   boots.error(err);

    //   if (docs.length === 0) return this();
    //   var _this = _.after(docs.length, this);
    //   _.each(docs, function (d) {

    //     db.Posts.count({author_id: d._id}, function (err, cnt) {
    //       boots.error(err);
    //       db.Members.update({_id: d._id}, {$set: {pcnt: cnt}}, _this);  
    //     });

    //   });
    
    // },

    function (err) {
      boots.error(err);
      console.log('members photos update...');
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      function swap(str) {
        str = 'https://fbcdn-sphotos-h-a.akamaihd.net/hphotos-ak-frc3/'
            + _.strRightBack(str, '/s720x720');
        return str;
      }

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        var update = {$set: {}};

        if (d.image && d.image.cf_url && d.image.cf_url.indexOf('s720x720') !== -1) {
          d.image.cf_url = swap(d.image.cf_url);
          update.$set.image = d.image;
        }

        if (d.thumbs) {
          var diff = false;
          _.each(d.thumbs, function (t) {
            if (t.cf_url && t.cf_url.indexOf('fbcdn.net') !== -1) {
              t.cf_url = swap(t.cf_url);
              diff = true;
            }
          });
          if (diff)
            update.$set.thumbs = d.thumbs;
        }

        if (_.isEmpty(update.$set)) return _this();
        db.Members.update({_id: d._id}, update, _this);
      });
    
    },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
  
});
