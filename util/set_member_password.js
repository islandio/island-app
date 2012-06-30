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
    .demand('password')
    .default('env', 'dev')
    .argv;

var db = argv.env === 'dev' ?
          'mongo://localhost:27018/island' :
          'mongo://islander:V[AMF?UV{b@10.112.1.168:27017/island';

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

// Connect to DB.
var memberDb;
var member;

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
    memberDb.collections.member.findOne({ key: argv.key }, this);
  },
  // delete member and all hits, views, ratings, comments, posts, medias
  function (err, mem) {
    errCheck(err, 'finding member');
    if (!mem)
      errCheck(new Error('not found'), 'could not find member');
    member = mem;
    member.password = argv.password;
    MemberDb.dealWithPassword(member);
    memberDb.collections.member.update({ _id: member._id },
                                  { $set: { password: member.password,
                                    salt: member.salt } },
                                  { safe: true }, this);
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nSet member password: ' + inspect(member));
    log('\nAll done!\n');
    process.exit(0);
  }
);
