#!/usr/bin/env node
/*
 * ship.js: Ship app to production.
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

    function () {
      console.log('crags update...');
      db.Crags.list({}, this);
    },
    function (err, docs) {
      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (!d.lat || !d.lon) return _this();
        db.Crags.update({_id: d._id}, {$set: {location: {latitude: d.lat, longitude: d.lon}},
            $unset: {lat: 1, lon: 1}}, _this);
      });
    },

    function () {
      console.log('ascents update...');
      db.Crags.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        db.Ascents.list({crag_id: d._id}, function (err, ds) {
          boots.error(err);
          if (ds.length === 0) return _this();
          var __this = _.after(ds.length, _this);
          _.each(ds, function (a) {
            db.Ascents.update({_id: a._id}, {$set: {location: d.location}}, __this);
          });
        });

      });
    },

    function () {
      console.log('posts update...');
      db.Posts.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        if (!d.member_id) return _this();
        db.Posts.update({_id: d._id}, {$set: {author_id: d.member_id},
            $unset: {member_id: 1}}, _this);

      });
    
    },
    

    function (err) {
      boots.error(err);
      console.log('comments update...');
      db.Comments.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        if (!d.member_id || !d.post_id) return _this();
        db.Comments.update({_id: d._id}, {$set: {author_id: d.member_id,
            parent_id: d.post_id}, $unset: {member_id: 1, post_id: 1}}, _this);

      });
    
    },
    
    
    function (err) {
      boots.error(err);
      console.log('medias update...');
      db.Medias.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        if (!d.member_id || !d.post_id) return _this();
        db.Medias.update({_id: d._id}, {$set: {author_id: d.member_id,
            parent_id: d.post_id}, $unset: {member_id: 1, post_id: 1}}, _this);

      });
    
    },

    
    function (err) {
      boots.error(err);
      console.log('posts add type update...');
      db.Posts.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        
        db.Medias.list({parent_id: d._id}, function (err, meds) {
          boots.error(err);
          var type = 'image';
          _.each(meds, function (m) {
            if (m.type === 'video')
              type = 'video';
          });
          db.Posts.update({_id: d._id}, {$set: {type: type}}, _this);
        });
      
      });
    },


    function (err) {
      boots.error(err);
      console.log('members update...');
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        db.Members.update({_id: d._id},
            {$set: {username: d.username && d.username !== '' ? _.slugify(d.username): com.key()}}, _this);
      });
    
    },


    function (err) {
      boots.error(err);
      console.log('posts key update...');
      db.Posts.list({}, {inflate: {
        author: _.extend(resources.profiles.member, {instagram: 1})
      }}, this);
    },
    function (err, docs) {
      boots.error(err);

      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        if (d.okey || d.key.indexOf('/') !== -1) return _this();

        var okey = d.key;
        var key = d.title && d.title !== '' ? _.slugify(d.title): null;
        if (!key || key.length < 8 || key === d.author.username
            || key === d.author.instagram) key = d.key;
        key = [d.author.username.toLowerCase(), key].join('/');

        db.Posts.update({_id: d._id}, {$set: {key: key, okey: d.key}},
            {force: {key: 1}}, _this);

      });

    },

    
    function (err) {
      boots.error(err);
      console.log('subscribing to posts...');
      db.Posts.list({}, {inflate: {author: resources.profiles.member}}, this);      
    },

    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        pubsub.subscribe(d.author, d, {style: 'watch', type: 'post'}, _this);
      });
    },


    function (err) {
      boots.error(err);
      console.log('flushing redis...');
      client.flushall(this);
    },


    function (err) {
      boots.error(err);
      console.log('posts reds index...');
      db.Posts.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      var search = reds.createSearch('posts');
      search.client = client;

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.title && d.title !== '' && d.title.match(/\w+/g))
          search.index(d.title, d._id.toString());
        _this();
      });

    },


    function (err) {
      boots.error(err);
      console.log('members reds index...');
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      var search = reds.createSearch('members');
      search.client = client;

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.displayName && d.displayName !== ''
            && d.displayName.match(/\w+/g))
          search.index(d.displayName, d._id.toString());
        if (d.username && d.username !== '' && d.username.match(/\w+/g))
            search.index(d.username, d._id.toString());
        _this();
      });

    },

    function (err) {
      boots.error(err);
      console.log('crags reds index...');
      db.Crags.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      var search = reds.createSearch('crags');
      search.client = client;

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (d.name && d.name !== '' && d.name.match(/\w+/g))
          search.index(d.name, d._id.toString());
        _this();
      });

    },

    function (err) {
      boots.error(err);
      console.log('Good to go.');
      process.exit(0);
    }
  );
  
});
