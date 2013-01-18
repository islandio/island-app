#!/usr/bin/env node

var log = require('console').log;
var mongodb = require('mongodb');
var redis = require('redis');
var reds = require('reds');
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

function errCheck(err, op) {
  if (err) {
    error('Error during ' + op + ':\n' + err.stack);
    process.exit(1);
  };
}

var db = 'mongodb://localhost:27018/island';
var redis_host = 'localhost';
var redis_pass = null;
var redis_port = 6379;
if (argv.env === 'pro') {
  log('Targeting production server!');
  db = 'mongodb://nodejitsu_sanderpick:as3nonkk9502pe1ugseg3mj9ev@ds043947.mongolab.com:43947/nodejitsu_sanderpick_nodejitsudb9750563292';
  redis_host = 'nodejitsudb2554783797.redis.irstack.com';
  redis_pass = 'f327cfe980c971946e80b8e975fbebb4';
}

var redisClient;
var search;
var memberDb;
var _id;

Step(
  function () {
    redisClient = redis.createClient(argv.redis_port, argv.redis_host);
    if (argv.redis_pass && argv.redis_host !== 'localhost') {
      redisClient.auth(argv.redis_host + ':' + argv.redis_pass, function (err) {
        if (err) throw err;
      });
    }
    redisClient.on('ready', this);
  },
  function () {
    log('Redis ready.');
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
    reds.createClient = function () {
      return exports.client || redisClient;
    };
    search = reds.createSearch('media');
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
            log('Indexing post: ' + post.title);
            _next();
          });
        });
      } else next();
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!');
    process.exit(0);
  }
);
