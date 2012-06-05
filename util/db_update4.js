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
    .default('env', 'dev')
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

var cloudfrontImageUrl = argv.env === 'pro' ?
                            'https://d1da6a4is4i5z6.cloudfront.net/' :
                            'https://d2a89oeknmk80g.cloudfront.net/';

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
  // tweak members
  function (err) {
    var next = this;
    memberDb.collections.member.find({})
            .toArray(function (err, mems) {
      errCheck(err, 'finding members');
      if (mems.length > 0) {
        var _next = _.after(mems.length, next);
        _.each(mems, function (mem) {
          if (mem.picture) {
            mem.image = {
              cf_url: mem.picture.source,
              meta: { width: mem.picture.width, height: mem.picture.height },
            };
            mem.thumbs = [{
              cf_url: mem.picture.source,
              meta: { width: mem.picture.width, height: mem.picture.height },
            }];
          } else {
            mem.image = null;
            mem.thumbs = null;
          }
          delete mem.picture;
          if (mem.provider === 'facebook')
            mem.facebook = mem.username;
          if (mem.username)
            mem.username = mem.key;
          log('\nUpdated member: ' + inspect(mem));
          memberDb.collections.member.update({ _id: mem._id },
                                              mem, { safe: true }, _next);
        });
      } else next();
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
