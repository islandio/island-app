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
    log('\nFinding lat longs ...\n');
    var next = this;
    memberDb.collections.media.find({})
            .toArray(function (err, media) {
      errCheck(err, 'finding media');
      if (media.length > 0) {
        var _next = _.after(media.length, next);
        _.each(media, function (med) {
          if (med.image
              && ((med.image.meta.latitude && med.image.meta.latitude !== 'null')
              || (med.image.meta.longitude && med.image.meta.longitude !== 'null')))
            log(med.image.meta.latitude, med.image.meta.longitude);
          if (med.video
              && ((med.video.meta.latitude && med.video.meta.latitude !== 'null')
              || (med.video.meta.longitude && med.video.meta.longitude !== 'null')))
            log(med.video.meta.latitude, med.video.meta.longitude);
          _.each(med.thumbs, function (t) {
            if ((t.meta.latitude && t.meta.latitude !== 'null')
                || (t.meta.longitude && t.meta.longitude !== 'null'))
              log(t.meta.latitude, t.meta.longitude);
          });
          _next();
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
