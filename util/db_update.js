#!/usr/bin/env node

// Update existing data to the new
// user, team, vehicle ,fleet format.

var log = require('console').log;
var mongodb = require('mongodb');
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
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
  // Rename medias collection to media
  function (err) {
    var next = this;
    memberDb.db.collection('medias', function (err, col) {
      errCheck(err, 'making medias collection');
      col.findOne({}, function (err, doc) {
        if (err || !doc) next(err);
        else {
          log('\nRenamed `medias` collection to `media`.');
          col.rename('media', next);
        } 
      });
    });
  },
  // Rename members collection to member
  function (err) {
    var next = this;
    memberDb.db.collection('members', function (err, col) {
      errCheck(err, 'making members collection');
      col.findOne({}, function (err, doc) {
        if (err || !doc) next(err);
        else {
          log('\nRenamed `members` collection to `member`.');
          col.rename('member', next);
        } 
      });
    });
  },
  // Rename comments collection to comment
  function (err) {
    var next = this;
    memberDb.db.collection('comments', function (err, col) {
      errCheck(err, 'making comments collection');
      col.findOne({}, function (err, doc) {
        if (err || !doc) next(err);
        else {
          log('\nRenamed `comments` collection to `comment`.');
          col.rename('comment', next);
        } 
      });
    });
  },
  // Drop logintokens
  function (err) {
    var next = this;
    memberDb.db.collection('logintokens', function (err, col) {
      errCheck(err, 'making logintokens collection');
      col.findOne({}, function (err, doc) {
        if (err || !doc) next(err);
        else {
          log('\nDropped `logintokens` collections.');
          col.drop(next);
        } 
      });
    });
  },
  // Delete indexes
  function (err) {
    // drop indexes
    memberDb.collections.member.dropIndexes(this.parallel());
    memberDb.collections.media.dropIndexes(this.parallel());
    memberDb.collections.comment.dropIndexes(this.parallel());
    memberDb.collections.sessions.drop(this.parallel());
  },
  // Reformat members.
  function (err) {
    // err if cols do not exist - but that's okay
    log('\nDeleted all indexes.');
    var next = this;
    memberDb.collections.member.find({})
            .toArray(function (err, mems) {
      errCheck(err, 'finding members');
      if (mems.length > 0) {
        var _next = _.after(mems.length, next);
        _.each(mems, function (mem) {
          mem.primaryEmail = mem.primaryEmail || mem.email;
          mem.created = mem.created || mem.joined;
          mem.role = 0;
          mem.displayName = mem.name.first + ' ' + mem.name.last;
          delete mem.name;
          delete mem.joined;
          delete mem.confirmed;
          delete mem.meta;
          delete mem.salt;
          delete mem.hashed_password;
          delete mem.email;
          log('\nUpdated member: ' + inspect(mem));
          memberDb.collections.member.update({ _id: mem._id },
                                              mem, { safe: true }, _next);
        });
      } else next();
    });
  },
  // Reformat media
  function (err) {
    errCheck(err, 'updating members');
    var next = this;
    memberDb.collections.media.find({})
            .toArray(function (err, media) {
      errCheck(err, 'finding media');
      if (media.length > 0) {
        var _next = _.after(media.length, next);
        _.each(media, function (med) {
          med.created = med.created || med.added;
          delete med.added;
          log('\nUpdated media: ' + inspect(med));
          memberDb.collections.media.update({ _id: med._id },
                                              med, { safe: true }, _next);
        });
      } else next();
    });
  },
  // Reformat comments
  function (err) {
    errCheck(err, 'updating media');
    var next = this;
    memberDb.collections.comment.find({})
            .toArray(function (err, comments) {
      errCheck(err, 'finding comments');
      if (comments.length > 0) {
        var _next = _.after(comments.length, next);
        _.each(comments, function (com) {
          com.media_id = com.media_id || com.parent_id;
          com.created = com.created || com.added;
          delete com.parent_id;
          delete com.added;
          delete com.comments;
          log('\nUpdated comments: ' + inspect(com));
          memberDb.collections.comment.update({ _id: com._id },
                                              com, { safe: true }, _next);
        });
      } else next();
    });
  },
  // Update my twitter name.
  function (err) {
    var next = this;
    errCheck(err, 'updating comments');
    memberDb.collections.member.findOne({ primaryEmail: 'sanderpick@gmail.com' },
                                        function (err, me) {
      errCheck(err, 'finding Sander');
      me.twitter = 'sanderpick';
      log('\nUpdated Sander\'s twitter name.');
      memberDb.collections.member.update({ _id: me._id },
                                          me, { safe: true }, next);
    });
  },
  // Done.
  function (err) {
    errCheck(err, 'at end');
    log('\nAll done!\n');
    process.exit(0);
  }
);
