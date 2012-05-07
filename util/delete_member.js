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
    .demand('id')
    .default('db', 'mongo://localhost:27018/island')
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

// Connect to DB.
var memberDb;
var _id = new ObjectID(argv.id);

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
  // remove member
  function (err) {
    log('\nDeleted member.');
    memberDb.collections.member.remove({ _id: _id }, this);
  },
  // delete all hits, views, ratings, comments, posts, medias
  function (err) {
    errCheck(err, 'removing member');
    log('Deleted member\'s hits.');
    memberDb.collections.hit.remove({ member_id: _id }, this.parallel());
    log('Deleted member\'s views.');
    memberDb.collections.view.remove({ member_id: _id }, this.parallel());
    log('Deleted member\'s ratings.');
    memberDb.collections.rating.remove({ member_id: _id }, this.parallel());
    log('Deleted member\'s comments.');
    memberDb.collections.comment.remove({ member_id: _id }, this.parallel());
    log('Deleted member\'s posts.');
    memberDb.collections.post.remove({ member_id: _id }, this.parallel());
    log('Deleted member\'s medias.');
    memberDb.collections.media.remove({ member_id: _id }, this.parallel());
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
