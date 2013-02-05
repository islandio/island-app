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
    .boolean('pro')
    .argv;

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

if (argv.pro)
  argv.db = 'mongodb://nodejitsu_sanderpick:as3nonkk9502pe1ugseg3mj9ev@ds043947.mongolab.com:43947/nodejitsu_sanderpick_nodejitsudb9750563292';

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
  // Update members
  function () {
    log('\nAdding config to members ...\n');
    var next = this;
    memberDb.collections.member.find({ config: { $exists: false }})
            .toArray(function (err, members) {
      errCheck(err, 'finding members');
      if (members.length > 0) {
        var _next = _.after(members.length, next);
        var config = {
          notifications: {
            comment: {
              email: true
            }
          }
        };
        _.each(members, function (member) {
          log('updated member:', member.displayName);
          memberDb.collections.member.update({ _id: member._id },
                                            { $set: { config: config } },
                                            { safe: true }, _next);
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
