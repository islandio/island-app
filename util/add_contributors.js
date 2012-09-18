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

var people = {
  'Stefan Rasmussen': 'dollar73@hotmail.com',
  'Guntram Joerg': 'joergguntram@hotmail.com',
  'Dominik Hadwiger': 'dominik.hadwiger@iplace.at',
  'Daniel Woods': 'dawoods89@gmail.com',
  'Courtney Sanders': 'csande13@gmail.com',
  'Clement Perotti': 'clement.perotti@gmail.com',
  'Magnus Mitboe': 'magmidt@hotmail.com',
  'Maria Sandbu': 'mariasanbu@hotmail.com',
  'Alex Puccio': 'puccio.alex@gmail.com',
  'Mina Weslie': 'Wujastyk: mina.climbing@gmail.com',
  'Hanna Midtbo': 'hmidtboe@gmail.com',
  'Theres Johansen': 'therese_27_1@hotmail.com',
  'Rune Osvald': 'rune@tyrili.no',
  'Carlo Traversi': 'Carlo.denai.traversi@gmail.com',
  'Clement Perotti': 'crossculturalchange@gmail.com',
  'Sasha DiGiulian': 'sdigiulian@aol.com',
  'Ricky Bell': 'bell.ricky@gmail.com',
};
var members = [];
var missing = [];

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
  // find members
  function (err) {
    // var group = this.group();
    var _next = _.after(_.size(people), this);
    _.each(people, function (email, name) {
      memberDb.collections.member.findOne({ $or: [{ emails: { value: email.toLowerCase() }},
                                          { displayName: name } ]}, _.bind(function (err, mem) {
        errCheck(err, 'finding member');
        if (mem) {
          log('Upgrading ' + mem.displayName + ' to contributor ...');
          mem.role = 0;
          memberDb.collections.member.update({ _id: mem._id },
                                              mem, { safe: true }, _next);
        } else {
          missing.push(name + ' <' + email.toLowerCase() + '>');
          _next();
        }
      }, this));
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nCould not find these people: \n');
    _.each(missing, function (str) {
      log(str);
    });
    log('\nAll done!\n');
    process.exit(0);
  }
);
