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
  // remove all embedded edge refereces
  function (err) {
    var next = this;
    memberDb.collections.post.update({}, { $unset : { medias: 1, comments: 1, views: 1 } },
                                    { safe: true, multi: true, }, this.parallel());
    memberDb.collections.media.update({}, { $unset : { ratings: 1, hits: 1 } },
                                    { safe: true, multi: true }, this.parallel());
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nRemoved all embedded edge refereces.');
    log('\nAll done!\n');
    process.exit(0);
  }
);
