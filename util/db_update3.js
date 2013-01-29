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
    .default('db', 'mongodb://localhost:27018/island')
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
          mem.emails = mems.emails || [{ value: mem.primaryEmail }];
          mem.emails = _.without(mem.emails, null);
          if (mem.key && mem.confirmed === undefined) {
            mem.confirmed = true;
            if (!mem.password) {
              mem.password = mem.primaryEmail.split('@')[0];
              MemberDb.dealWithPassword(mem);
            }
          }
          log('\nUpdated member: ' + inspect(mem));
          memberDb.collections.member.update({ _id: mem._id },
                                              mem, { safe: true }, _next);
        });
      } else next();
    });
  },
  function (err) {
    errCheck(err, 'tweaking members');
    var next = this;
    memberDb.collections.media.find({ type: 'image' })
            .toArray(function (err, meds) {
      errCheck(err, 'finding medias');
      if (meds.length > 0) {
        var _next = _.after(meds.length, next);
        _.each(meds, function (med) {
          if (!med.thumbs[0].cf_url) {
            med.thumbs[0].cf_url = cloudfrontImageUrl + med.thumbs[0].id.substr(0, 2)
                          + '/' + med.thumbs[0].id.substr(2)
                          + '.' + med.thumbs[0].ext;
          }
          log('\nUpdated media: ' + inspect(med));
          memberDb.collections.media.update({ _id: med._id },
                                              med, { safe: true }, _next);
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
