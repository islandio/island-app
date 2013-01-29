#!/usr/bin/env node

var log = require('console').log;
var mongodb = require('mongodb');
var search = require('reds').createSearch('media');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

var MemberDb = require('../member_db.js').MemberDb;

var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongodb://localhost:27018/nodejitsu_sanderpick_nodejitsudb9750563292')
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}


// Connect to DB.
var memberDb;
Step(
  function () {
    var next = this;
    mongodb.connect(argv.db, {
                      server: { poolSize: 4 },
                      db: { native_parser: false,
                            reaperTimeout: 600000 },
                    }, function (err, db) {
      errCheck(err, 'connect(' + argv.db + ')');
      new MemberDb(db, { ensureIndexes: false }, next);
    });
  },
  function (err, mDb) {
    memberDb = mDb;
    this();
  },
  // Delete indexes
  function () {
    // drop indexes
    memberDb.collections.member.dropIndexes(this.parallel());
    memberDb.collections.post.dropIndexes(this.parallel());
    memberDb.collections.media.dropIndexes(this.parallel());
    memberDb.collections.comment.dropIndexes(this.parallel());
    memberDb.collections.rating.dropIndexes(this.parallel());
    memberDb.collections.hit.dropIndexes(this.parallel());
    memberDb.collections.view.dropIndexes(this.parallel());
  },
  // Update ratings
  function (err) {
    // err if cols do not exist - but that's okay
    log('\nDeleted all indexes.');
    var next = this;
    memberDb.collections.rating.find({})
            .toArray(function (err, ratings) {
      errCheck(err, 'finding ratings');
      if (ratings.length > 0) {
        var _next = _.after(ratings.length, next);
        _.each(ratings, function (rating) {
          console.log(typeof rating.val)
          memberDb.collections.rating.update({ _id: rating._id },
                                            { $set : { val : Number(rating.val) } },
                                            { safe: true }, _next);
        });
      } else next();
    });
  },
  // Reformat posts
  function (err) {
    errCheck(err, 'updating ratings');
    log('\nMade ratings numbers, asshole.');
    var next = this;
    memberDb.findPosts({}, function (err, docs) {
      if (docs.length === 0) return next();
      var _next = _.after(docs.length, next);
      _.each(docs, function (doc) {
        if (doc.comments)
          memberDb.collections.post.update({ _id: doc._id }, { $inc: { ccnt: doc.comments.length }}, { safe: true }, _next);
        else if (doc.views)
          memberDb.collections.post.update({ _id: doc._id }, { $inc: { vcnt: doc.views.length }}, { safe: true }, _next);
        else if (doc.medias) {
          if (doc.medias.length === 0) return _next();
          var __next = _.after(doc.medias.length, _next);
          _.each(doc.medias, function (med) {
            if (med.hits)
              memberDb.collections.media.update({ _id: med._id }, { $inc: { tcnt: med.hits.length }}, { safe: true }, _next);
            else if (med.ratings) {
              var h = 0;
              _.each(med.ratings, function (r) {
                h += Number(r.val);
                console.log(r);
              });
              console.log('TOTAL', h);
              memberDb.collections.media.update({ _id: med._id }, { $inc: { hcnt: h }}, { safe: true }, _next);
            } else __next();
          });
        } else _next();
      });
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
