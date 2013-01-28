#!/usr/bin/env node

var log = require('console').log;
var mongodb = require('mongodb');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var _ = require('underscore');
_.mixin(require('underscore.string'));

var MemberDb = require('../member_db.js').MemberDb;

var optimist = require('optimist');
var argv = optimist
    .demand('key')
    .default('env', 'dev')
    .argv;

var db = argv.env === 'pro' ?
          'mongodb://nodejitsu_sanderpick:as3nonkk9502pe1ugseg3mj9ev@ds043947.mongolab.com:43947/nodejitsu_sanderpick_nodejitsudb9750563292':
          'mongodb://localhost:27018/island';

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

// Connect to DB.
var memberDb;
var _id;
var post;

Step(
  function () {
    var next = this;
    mongodb.connect(db, {
                      server: { poolSize: 4 },
                      db: { native_parser: false,
                            reaperTimeout: 600000 },
                    }, function (err, db) {
      errCheck(err, 'connect(' + db + ')');
      new MemberDb(db, { ensureIndexes: false }, next);
    });
  },
  function (err, mDb) {
    memberDb = mDb;
    this();
  },
  // find post
  function (err) {
    memberDb.collections.post.findOne({ key: argv.key }, this);
  },
  // find post media
  function (err, p) {
    errCheck(err, 'finding post');
    if (!p)
      errCheck(new Error('not found'), 'could not find post');
    _id = p._id;
    post = p;
    var next = this;
    memberDb.collections.media.find({ post_id: _id })
            .toArray(function (err, meds) {
      errCheck(err, 'finding medias');
      if (meds.length > 0) {
        var _next = _.after(meds.length * 3, next);
        // delete all media and all hits and ratings
        _.each(meds, function (med) {
          log('\nDeleted media: ' + inspect(med));
          memberDb.collections.media.remove({ _id: med._id }, _next);
          log('Deleted media\'s hits.');
          memberDb.collections.hit.remove({ media_id: _id }, _next);
          log('Deleted media\'s ratings.');
          memberDb.collections.rating.remove({ media_id: _id }, _next);
        });
      } else next();
    });
  },
  // delete post and all ratings and comments
  function (err) {
    errCheck(err, 'removing post');
    log('\nDeleted post: ' + inspect(post));
    memberDb.collections.post.remove({ _id: _id }, this.parallel());
    log('Deleted post\'s views.');
    memberDb.collections.view.remove({ post_id: _id }, this.parallel());
    log('Deleted post\'s comments.');
    memberDb.collections.comment.remove({ post_id: _id }, this.parallel());
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
