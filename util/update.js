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
    //     var unset = {};
    //     if (!_.isObject(d.location)) unset.location = 1;
    //     if (!_.isObject(d.hometown)) unset.hometown = 1;
    //     if (!_.isEmpty(unset)) {
    //       db.Members._update({_id: d._id}, {$unset: unset}, _this);
    //     } else _this();

    //   });
    
    // },

    // function () {
    //   console.log('members update...');
    //   var m = function () {
    //     emit(this.primaryEmail, 1);
    //   }
    //   var r = function (k, vals) {
    //     return Array.sum(vals);
    //   }
    //   db.Members.mapReduce(m, r, {
    //     query: {primaryEmail: {$exists: 1}},
    //     out: {inline: 1}
    //   }, this);
    // },
    // function (err, res) {
    //   boots.error(err);

    //   if (res.length === 0) return this();
    //   var _this = _.after(res.length, this);
    //   _.each(res, function (r) {
    //     if (r.value < 2) return _this();

    //     db.Members.list({primaryEmail: r._id}, {limit: 1, sort: {created: -1}},
    //         function (err, d) {
    //       boots.error(err);
    //       if (!d || !d[0]) return _this();
    //       db.Members._update({_id: d[0]._id}, {$unset: {primaryEmail: 1}}, _this);
    //     });

    //   });
    // },

    // function (err) {
    //   boots.error(err);
    //   console.log('members photos update...');
    //   db.Members.list({}, this);
    // },
    // function (err, docs) {
    //   boots.error(err);

    //   function swap(str) {
    //     str = 'https://fbcdn-sphotos-h-a.akamaihd.net/hphotos-ak-frc3/'
    //         + _.strRightBack(str, '/s720x720');
    //     return str;
    //   }

    //   if (docs.length === 0) return this();
    //   var _this = _.after(docs.length, this);
    //   _.each(docs, function (d) {
    //     var update = {$set: {}};

    //     if (d.image && d.image.cf_url && d.image.cf_url.indexOf('s720x720') !== -1) {
    //       d.image.cf_url = swap(d.image.cf_url);
    //       update.$set.image = d.image;
    //     }

    //     if (d.thumbs) {
    //       var diff = false;
    //       _.each(d.thumbs, function (t) {
    //         if (t.cf_url && t.cf_url.indexOf('fbcdn.net') !== -1) {
    //           t.cf_url = swap(t.cf_url);
    //           diff = true;
    //         }
    //       });
    //       if (diff)
    //         update.$set.thumbs = d.thumbs;
    //     }

    //     if (_.isEmpty(update.$set)) return _this();
    //     db.Members.update({_id: d._id}, update, _this);
    //   });
    
    // },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
  
});
