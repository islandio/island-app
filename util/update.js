#!/usr/bin/env node
/*
 * update.js: Makes changes to existing data.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('dburi', 'Mongo database name')
      .default('dburi', 'island')
    .describe('pro', 'Use live Mongo database')
      .boolean('pro')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var mongodb = require('mongodb');
var util = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var clc = require('cli-color');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../lib/db.js');
var com = require('../lib/common.js');
var resources = require('../lib/resources');
var service = require('../lib/service');

var MONGO_URI = argv.pro ? 'mongodb://nodejitsu:af8c37eb0e1a57c1e56730eb635f6093':
    'mongodb://localhost:27018/' + argv.dburi;

// Errors wrapper.
function errCheck(err) {
  if (err) {
    util.error(clc.red(err.stack || err));
    process.exit(1);
  };
}

Step(
  function () {
    new db.Connection(MONGO_URI, {}, this);
  },
  function (err, connection) {
    if (err) {
      util.error(err);
      process.exit(1);
      return;
    }

    var _this = _.after(_.size(resources.collections), this);
    _.each(resources.collections, function (conf, name) {
      connection.add(name, conf, _this);
    });

  },

  // Do stuff.
  // function (err) {
  //   db.Posts.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     if (!d.member_id) return _this();
  //     db.Posts.update({_id: d._id}, {$set: {author_id: d.member_id},
  //         $unset: {member_id: 1}}, _this);

  //   });
  
  // },
  // function (err) {
  //   db.Hits.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     if (!d.member_id) return _this();
  //     db.Hits.update({_id: d._id}, {$set: {author_id: d.member_id},
  //         $unset: {member_id: 1}}, _this);

  //   });
  
  // },
  // function (err) {
  //   errCheck(err);
  //   db.Comments.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     if (!d.member_id || !d.post_id) return _this();
  //     db.Comments.update({_id: d._id}, {$set: {author_id: d.member_id,
  //         parent_id: d.post_id}, $unset: {member_id: 1, post_id: 1}}, _this);

  //   });
  
  // },
  // function (err) {
  //   errCheck(err);
  //   db.Medias.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     if (!d.member_id || !d.post_id) return _this();
  //     db.Medias.update({_id: d._id}, {$set: {author_id: d.member_id,
  //         parent_id: d.post_id}, $unset: {member_id: 1, post_id: 1}}, _this);

  //   });
  
  // },
  // function (err) {
  //   errCheck(err);
  //   db.Views.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     if (!d.member_id || !d.post_id) return _this();
  //     db.Views.update({_id: d._id}, {$set: {author_id: d.member_id,
  //         parent_id: d.post_id}, $unset: {member_id: 1, post_id: 1}}, _this);

  //   });
  
  // },

  // function (err) {
  //   errCheck(err);
  //   db.Members.list({}, this);
  // },
  // function (err, docs) {
  //   errCheck(err);

  //   var _this = _.after(docs.length, this);
  //   _.each(docs, function (d) {

  //     db.Members.update({_id: d._id},
  //         {$set: {username: _.slugify(d.username)}}, _this);
  //   });
  
  // },
  function (err) {
    errCheck(err);

    db.Posts.list({}, {inflate: {
      author: _.extend(resources.profiles.member, {instagram: 1})
    }}, this);
  },
  function (err, docs) {
    errCheck(err);

    var _this = _.after(docs.length, this);
    _.each(docs, function (d) {

      if (d.okey || d.key.indexOf('/') !== -1) return _this();

      var okey = d.key;
      var key = d.title && d.title !== '' ? _.slugify(d.title): null;
      if (!key || key.length < 8 || key === d.author.username
          || key === d.author.instagram) key = d.key;
      key = [d.author.username, key].join('/');

      db.Posts.update({_id: d._id}, {$set: {key: key, okey: d.key}},
          {force: {key: 1}}, _this);

    });

  },
  function (err) {
    errCheck(err);
    console.log(clc.green('Good to go.'));
    process.exit(0);
  }
);
