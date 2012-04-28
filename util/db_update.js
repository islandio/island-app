#!/usr/bin/env node

// Update existing data to the new
// user, team, vehicle ,fleet format.

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
  // Rename medias collection to post
  function (err) {
    var next = this;
    memberDb.db.collection('medias', function (err, col) {
      errCheck(err, 'making medias collection');
      col.findOne({}, function (err, doc) {
        if (err || !doc) next(err);
        else {
          log('\nRenamed `medias` collection to `post`.');
          col.rename('post', next);
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
  // Reformat posts
  function (err) {
    errCheck(err, 'updating members');
    var next = this;
    memberDb.collections.post.find({})
            .toArray(function (err, posts) {
      errCheck(err, 'finding posts');
      if (posts.length > 0) {
        var _next = _.after(posts.length, next);
        _.each(posts, function (post) {
          post.created = post.created || post.added;
          post.ratings = post.meta.ratings;
          post.hits = post.meta.hits;
          delete post.added;
          delete post.meta;
          delete post.terms;
          delete post.type;
          var media = {
            key: post.key,
            member_id: post.member_id,
            ratings: post.ratings,
            hits: post.hits,
            created: post.created,
          };
          var att = post.attached;
          if (att.image_full)
            _.extend(media, {
              type: 'image',
              image: att.image_full,
              thumbs: [att.image_thumb],
            });
          else
            _.extend(media, {
              type: 'video',
              video: att.video_encode,
              image: att.video_placeholder,
              poster: att.video_poster,
              thumbs: att.video_thumbs,
            });
          memberDb.createMedia(media, function (err, doc) {
            errCheck(err, 'creating post media');
            delete post.attached;
            delete post.ratings;
            delete post.hits;
            post.medias = [doc._id];
            log('\nUpdated post: ' + post.title);
            memberDb.collections.post.update({ _id: post._id },
                                              post, { safe: true }, _next);
          });
        });
      } else next();
    });
  },
  // Reformat comments
  function (err) {
    errCheck(err, 'updating posts');
    var next = this;
    memberDb.collections.comment.find({})
            .toArray(function (err, comments) {
      errCheck(err, 'finding comments');
      if (comments.length > 0) {
        var _next = _.after(comments.length, next);
        _.each(comments, function (com) {
          com.post_id = com.media_id || com.parent_id;
          com.created = com.created || com.added;
          delete com.media_id;
          delete com.parent_id;
          delete com.added;
          delete com.comments;
          log('\nUpdated comment: ' + inspect(com));
          memberDb.collections.comment.update({ _id: com._id },
                                              com, { safe: true }, _next);
        });
      } else next();
    });
  },
  // Redo ratings...
  function (err) {
    var next = this;
    errCheck(err, 'updating comments');
    memberDb.collections.media.find({})
            .toArray(function (err, media) {
      errCheck(err, 'finding media');
      if (media.length > 0) {
        var _next = _.after(media.length, next);
        _.each(media, function (med) {
          var oldRatings = med.ratings;
          Step(
            function () {
              memberDb.collections.media.update({ _id: med._id },
                                                { $set : { ratings : [] } },
                                                { safe: true }, this);
            },
            function (err) {
              errCheck(err, 'clearing ratings');
              if (oldRatings && oldRatings.length > 0) {
                var __next = _.after(oldRatings.length, _next);
                _.each(oldRatings, function (rat) {
                  var props = {
                    member_id: med.member_id,
                    media_id: med._id,
                    val: rat.hearts,
                  };
                  memberDb.createRating(props, function (err, rat) {
                    errCheck(err, 'adding rating');
                    log('\nAdded rating: ' + inspect(rat));
                    __next();
                  });
                });
              } else _next();
            }
          );
        });
      } else next();
    });
  },
  // Index posts
  function (err) {
    var next = this;
    errCheck(err, 'redo ratings');
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
            search.index(post.body, post._id);
            if (mem.displayName && mem.displayName !== '')
              search.index(mem.displayName, post._id);
            log('\nIndexing post: ' + post.title);
            _next();
          });
        });
      } else next();
    });
  },
  // Update my twitter name.
  function (err) {
    var next = this;
    errCheck(err, 'indexing posts');
    memberDb.collections.member.findOne({ primaryEmail: 'sanderpick@gmail.com' },
                                        function (err, me) {
      errCheck(err, 'finding Sander');
      if (me) {
        me.twitter = 'sanderpick';
        log('\nUpdated Sander\'s twitter name.');
        memberDb.collections.member.update({ _id: me._id },
                                            me, { safe: true }, next);
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
