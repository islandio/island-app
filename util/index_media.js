#!/usr/bin/env node

var log = require('console').log;
var mongodb = require('mongodb');
var search = require('reds').createSearch('media');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var _ = require('underscore');
_.mixin(require('underscore.string'));

var MemberDb = require('../member_db.js').MemberDb;

var optimist = require('optimist');
var argv = optimist
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
var _id;

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
  // Index posts
  function () {
    var next = this;
    memberDb.collections.post.find({})
            .toArray(function (err, posts) {
      errCheck(err, 'finding posts');
      if (posts.length > 0) {
        var _next = _.after(posts.length, next);
        _.each(posts, function (post) {
          memberDb.collections.member.findOne({ _id: post.member_id },
                                              function (err, mem) {
            errCheck(err, 'finding member for post update');
            search.index(post.title, post._id);
            // search.index(post.body.replace(/#island/g, ''), post._id);
            if (mem.displayName && mem.displayName !== '')
              search.index(mem.displayName, post._id);
            log('\nIndexing post: ' + post.title);
            _next();
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
