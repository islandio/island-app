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
    next();
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
