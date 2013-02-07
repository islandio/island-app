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
var EventDb = require('../event_db.js').EventDb;

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

var channels = { all: 'island_test' };

if (argv.pro) {
  argv.db = 'mongodb://nodejitsu_sanderpick:as3nonkk9502pe1ugseg3mj9ev@ds043947.mongolab.com:43947/nodejitsu_sanderpick_nodejitsudb9750563292';
  channels = { all: 'island' };
}

// Connect to DB.
var memberDb;
var eventDb;
Step(
  function () {
    var next = this;
    mongodb.connect(argv.db, {
                      server: { poolSize: 4 },
                      db: { native_parser: false,
                            reaperTimeout: 600000 },
                    }, function (err, db) {
      errCheck(err, 'connect(' + argv.db + ')');
      new MemberDb(db, { ensureIndexes: false }, next.parallel());
      new EventDb(db, { ensureIndexes: false }, next.parallel());
    });
  },
  function (err, mDb, eDb) {
    memberDb = mDb;
    eventDb = eDb;
    this();
  },
  // Update members
  function () {
    log('\nAdding subs to posts members ...\n');
    var next = this;
    memberDb.collections.post.find({})
            .toArray(function (err, posts) {
      errCheck(err, 'finding posts');
      if (posts.length > 0) {
        var _next = _.after(posts.length, next);
        _.each(posts, function (post) {
          memberDb.collections.member.findOne({ _id: post.member_id },
              function (err, mem) {
            errCheck(err, 'getting member');
            eventDb.subscribe({
              member_id: mem._id,
              post_id: post._id,
              channel: channels.all + '-' + mem.key,
            }, function (err, sub) {
              errCheck(err, 'adding sub');
              log('sub ' + mem.displayName + ' to ' + post.title);
              _next();
            });
          });
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
