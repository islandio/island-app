#!/usr/bin/env node

/**
 * Arguments.
 */
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 3644)
    .describe('db', 'MongoDb URL to connect to')
      .default('db', 'mongo://localhost:27018/island')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}


/**
 * Environment
 */
// HACK!
var LOCAL = process.NODE_ENV !== 'production';

/**
 * Module dependencies.
 */
var express = require('express');
var now = require('now');
var mongodb = require('mongodb');
var mongoStore = require('connect-mongodb');

var stylus = require('stylus');
var jade = require('jade');
var templates = require('./templates');

var util = require('util'), debug = util.debug, inspect = util.inspect;
var fs = require('fs');
var path = require('path');
var log = require('./log.js').log;
var logTimestamp = require('./log.js').logTimestamp;

var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var color = require('cli-color');

// var Notify = require('./notify');

var MemberDb = require('./member_db.js').MemberDb;

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

var transloadit = { auth: { key: '8a36aa56062f49c79976fa24a74db6cc' }};
transloadit.template_id = LOCAL ? '29c60cfc5b9f4e8b8c8bf7a9b1191147' :
                          'dd77fc95cfff48e8bf4af6159fd6b2e7';

var cloudfrontImageUrl = LOCAL ? 'https://d2a89oeknmk80g.cloudfront.net/' :
                                'https://d1da6a4is4i5z6.cloudfront.net/';
var cloudfrontVideoUrl = LOCAL ? 'https://d2c2zu8qn6mgju.cloudfront.net/' :
                                'https://d1ehvayr9dfk4s.cloudfront.net/';
var cloudfrontAudioUrl = LOCAL ? 'https://d2oapa8usgizyg.cloudfront.net/' :
                                'https://dp3piv67f7p06.cloudfront.net/';


// Configuration

var app = module.exports = express.createServer();
var everyone;

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  // Notify.active = false;
});

app.configure('production', function () {
  app.use(express.errorHandler());
  // Notify.active = true;
});

app.set('sessionStore', new mongoStore({
  db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
}, function (err) {
  if (err) log('Error creating mongoStore: ' + err);
}));

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + '/public/graphics/favicon.ico'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());

  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one week
    secret: '69topsecretislandshit69',
    store: app.set('sessionStore'),
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.logger({
    format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms'
  }));

  app.use(express.methodOverride());
  app.use(app.router);
  app.use(stylus.middleware({ src: __dirname + '/public' }));
  app.use(express.static(__dirname + '/public'));
});


// Passport session cruft

passport.serializeUser(function (member, cb) {
  cb(null, member._id.toString());
});

passport.deserializeUser(function (id, cb) {
  memberDb.findMemberById(id, function (err, member) {
    cb(err, member);
  });
});

////////////// Utils

app.util = {
  formatCommentText: function (str) {
    var linkExp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    str = str.replace(/\n/g, '<br/>');
    // str = str.replace(/\s/g, '&nbsp;');
    str = str.replace(linkExp,"<a href='$1' target='_blank'>$1</a>");
    return str;
  },
};


////////////// Helpers

function authorize(req, res, cb) {
  var memberId = req.session.passport.user;
  if (memberId) {
    memberDb.findMemberById(memberId, function (err, member) {
      if (err) return cb(err);
      if (!member) {
        res.redirect('/login');
        return cb('Member and Session do NOT match!');
      }
      req.user = member;
      cb(null, member);
    });
  } else {
    res.redirect('/login');
    cb('Session has no Member.');
  }
}

function getMedia(limit, cb) {
  memberDb.findMedia({}, { limit: limit,
                    sort: { created: -1 } }, cb);
}
function getTrending(limit, cb) {
  Step(
    function () {
      memberDb.findPosts({}, { limit: 100, sort: { created: -1 }}, this);
    },
    function (err, posts) {
      if (err) return cb(err);
      var media = [];
      _.each(posts, function (post) {
        post.edges = edgeToPresent(1, post, 24);
        _.each(post.views, function (e) {
          post.edges += edgeToPresent(0.5, e, 12);
        });
        _.each(post.comments, function (e) {
          post.edges += edgeToPresent(2, e, 48);
        });
        _.each(post.medias, function (med) {
          med.edges = post.edges + edgeToPresent(1, med, 24);
          _.each(med.hits, function (e) {
            med.edges += edgeToPresent(1, e, 12);
          });
          _.each(med.ratings, function (e) {
            med.edges += edgeToPresent(e.val, e, 24);
          });
        });
        media = media.concat(post.medias);
      });
      media.sort(function (a, b) {
        return b.edges - a.edges;
      });
      cb(err, _.first(media, limit));
    }
  );
  function edgeToPresent(initial, edge, span) {
    var created = (new Date(edge.created)).getTime();
    var constant = span * 60 * 60 * 1000 / 5;
    return initial * Math.exp(-((new Date()).getTime() - created) / constant);
  }
}
function getRecentComments(limit, memberId, cb) {
  if ('function' === typeof memberId) {
    cb = memberId;
    memberId = null;
  }
  var query = memberId ? { member_id: memberId } : {};
  memberDb.findComments(query, { limit: limit,
                        sort: { created: -1 } }, cb);
}
function getTwitterNames(cb) {
  memberDb.findTwitterNames(cb);
}

function renderMedia(med, cb) {
  cb(null, templates.object({ object: med }));
}

function renderComment(params, cb) {
  // HACK!!
  params.app = app;
  cb(null, templates.comment(params));
}


////////////// Web Routes

// Home
app.get('/', authorize, function (req, res) {
  Step(
    function () {
      getMedia(50, this.parallel());
      getRecentComments(5, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, media, comments, twitters) {
      res.render('index', {
        part: 'media',
        media: media,
        trends: trends,
        comments: comments,
        member: req.user,
        twitters: twitters,
      });
    }
  );
});

// Landing page
app.get('/login', function (req, res) {
  res.render('login');
});

// Redirect the user to Facebook for authentication.
// When complete, Facebook will redirect the user
// back to the application at /auth/facebook/return.
// ** The passport strategy initialization must
// happen here becuase host needs to be snarfed from req.
app.get('/auth/facebook', function (req, res, next) {
  // Add referer to session so we can use it on return.
  // This way we can preserve query params in links.
  req.session.referer = req.headers.referer;
  var host = req.headers.host.split(':')[0];
  var home = 'http://' + host + ':' + argv.port + '/';
  passport.use(new FacebookStrategy({
      clientID: 203397619757208,
      clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2',
      callbackURL: 'http://island.io:3644/' + 'auth/facebook/callback',
    },
    function (accessToken, refreshToken, profile, done) {
      profile.accessToken = accessToken;
      memberDb.findOrCreateMemberFromFacebook(profile,
            function (err, member) {
        done(err, member);
      });
    }
  ));
  passport.authenticate('facebook', { scope: [
                        'email',
                        'user_about_me',
                        'user_birthday',
                        'user_website',
                        'user_status',
                        'user_photos'] })(req, res, next);
});

// Facebook will redirect the user to this URL
// after authentication. Finish the process by
// verifying the assertion. If valid, the user will be
// logged in. Otherwise, authentication has failed.
app.get('/auth/facebook/callback', function (req, res, next) {
  passport.authenticate('facebook', { successRedirect: '/',
                                    failureRedirect: '/login' })(req, res, next);
});

// We logout via an ajax request.
app.get('/logout', function (req, res) {
  req.logOut();
  res.redirect('/');
});

// Add media form
app.get('/add', authorize, function (req, res) {
  if (req.user.role !== 0)
    return res.redirect('/');
  Step(
    function () {
      getMedia(50, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, media, twitters) {
      res.render('index', {
        part: 'add',
        tlip: transloadit,
        grid: media,
        member: req.user,
        twitters: twitters,
      });
    }
  );
});

// Media search
app.get('/search/:query', function (req, res) {
  var fn = '__clear__' === req.params.query ?
            _.bind(getMedia, {}, 50) :
            _.bind(memberDb.searchPosts, memberDb,
                  req.params.query);
  fn(function (err, docs) {
    if (err) return fail(err);
    Step(
      function () {
        var group = this.group();
        _.each(docs, function (doc) {
          renderMedia(doc, group());
        });
      },
      function (err, results) {
        if (err) return fail(err);
        res.send({ status: 'success',
                 data: { results: results } });
      }
    );
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});

// Media search
app.get('/member/:key', function (req, res) {
  Step(
    function () {
      memberDb.findMemberByKey(req.params.key, this.parallel());
      getMedia(50, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, member, media, twitters) {
      if (err || !member)
        return res.render('404');
      getRecentComments(5, member._id, function (err, coms) {
        if (err)
          return res.render('500');
        res.render('index', {
        part: 'profile',
        data: member,
        comments: coms,
        grid: media,
        twitters: twitters,
        member: req.user,
      });
      });
    }
  );
});


// Single object
app.get('/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findPosts({ key: req.params.key },
                        { limit: 1 }, this.parallel());
      getMedia(50, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, post, grid, twitters) {
      if (err || !post || post.length === 0)
        return res.render('404');
      post = _.first(post);
      // record view
      memberDb.createView({
        post_id: post._id,
        member_id: req.user._id,
      }, function (err, doc) {
        if (err) throw new Error('Failed to create view');
      });
      // prepare document
      _.each(post.medias, function (med) {
        var rating = _.find(med.ratings.reverse(), function (rat) {
          return req.user._id.toString() === rat.member_id.toString();
        });
        med.hearts = rating ? rating.val : 0;
      });
      _.each(post.comments, function (com) {
        delete com.post;
      });
      res.render('index', {
        part: 'single',
        post: post,
        grid: grid,
        member: req.user,
        twitters: twitters,
      });
    }
  );
});


// Add media from Transloadit
app.put('/insert', authorize, function (req, res) {
  if (!req.body.post || !req.body.assembly
      || req.body.assembly.results.length === 0)
    return done(new Error('Failed to insert post'))
  var results = req.body.assembly.results;
  function done(err) {
    if (err) res.send({ status: 'error',
                      message: err.stack });
    else res.send({ status: 'success' });
  }
  Step(
    function () {
      var post = req.body.post;
      post.member = req.user;
      post.medias = [];
      memberDb.createPost(post, this);
    },
    function (err, doc) {
      if (err) return done(err);
      if (!doc) return done(new Error('Failed to create post'));
      var num = 0;
      if (results.image_full)
        num += results.image_full.length;
      if (results.video_encode)
        num += results.video_encode.length;
      if (results.audio_encode)
        num += results.audio_encode.length;
      if (num === 0)
        return done(new Error('Nothing was received from Transloadit'));
      var _next = _.after(num, this);
      _.each(results, function (val, key) {
        _.each(val, function (result) {
          var prefix;
          switch (_.words(key, '_')[0]) {
            case 'image': prefix = cloudfrontImageUrl; break;
            case 'video': prefix = cloudfrontVideoUrl; break;
            case 'audio': prefix = cloudfrontAudioUrl; break;
          }
          result.cf_url = prefix + result.id.substr(0, 2)
                          + '/' + result.id.substr(2)
                          + '.' + result.ext;
          if ('image_full' !== key && 'video_encode' !== key
              && 'audio_encode' !== key) return;
          var media = {
            type: result.type,
            key: doc.key,
            member_id: req.user._id,
          };
          media[result.type] = result;
          switch (key) {
            case 'image_full':
              _.extend(media, {
                thumbs: _.filter(results.image_thumb, function (img) {
                          return img.original_id === result.original_id; }),
              });
              break;
            case 'video_encode':
              _.extend(media, {
                image: _.find(results.video_placeholder, function (img) {
                          return img.original_id === result.original_id; }),
                poster: _.find(results.video_poster, function (img) {
                          return img.original_id === result.original_id; }),
                thumbs: _.filter(results.video_thumbs, function (img) {
                          return img.original_id === result.original_id; }),
              });
              break;
            case 'audio_encode':
              _.extend(media, {});
              break;
          }
          memberDb.createMedia(media, function (err, med) {
            if (err) return done(err);
            doc.medias.push(med._id);
            everyone.distributeMedia(med);
            _next(null, doc);
          });
        });
      });
    },
    function (err, doc) {
      memberDb.collections.post.update({ _id: doc._id },
                                      { $set : { medias: doc.medias } },
                                      { safe: true }, this);
    }, done
  );
});


// Click media
app.put('/hit/:mediaId', function (req, res) {
  // TODO: permissions...
  if (!req.params.mediaId)
    fail(new Error('Failed to hit media'));
  var props = {
    media_id: req.params.mediaId,
    member_id: req.user._id,
  };
  memberDb.createHit(props, function (err, doc) {
    if (err) return fail(err);
    res.send({ status: 'success' });
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});


// Add comment
app.put('/comment/:postId', function (req, res) {
  // TODO: permissions...
  if (!req.params.postId || !req.body.body)
    fail(new Error('Failed to insert comment'));
  var props = {
    post_id: req.params.postId,
    member_id: req.user._id,
    body: req.body.body,
  };
  memberDb.createComment(props, function (err, doc) {
    if (err) return fail(err);
    everyone.distributeComment(doc);
    res.send({ status: 'success', data: {
             comment: doc } });
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});


// Add rating
app.put('/rate/:mediaId', function (req, res) {
  // TODO: permissions...
  if (!req.params.mediaId || !req.body.val)
    fail(new Error('Failed to insert rating'));
  var props = {
    media_id: req.params.mediaId,
    member_id: req.user._id,
    val: req.body.val,
  };
  memberDb.createRating(props, function (err, doc) {
    if (err) return fail(err);
    res.send({ status: 'success', data: {
             val: doc.val }});
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});


////////////// Initialize and Listen

var memberDb;
var trends;

if (!module.parent) {

  Step(
    // Connect to MemberDb:
    function () {
      log('Connecting to MemberDb:', argv.db);
      mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
    }, function (err, db) {
      if (err) return this(err);
      new MemberDb(db, { ensureIndexes: true }, this);
    }, function (err, mDb) {
      if (err) return this(err);
      memberDb = mDb;
      this();
    },

    // Listen:
    function (err) {
      if (err) return this(err);
      app.listen(argv.port);

      // init now.js
      everyone = now.initialize(app);

      // add new object to everyone's page
      everyone.distributeMedia = function (media) {
        renderMedia(media, function (err, html) {
          if (err) return log('\nFailed to render media - ' + inspect(media)
                              + '\nError: ' + inspect(err));
          everyone.now.receiveMedia(html);
        });
      };

      // add new comment to everyone's page
      everyone.distributeComment = function (comment) {
        renderComment({ comment: comment, showMember: true },
                      function (err, html) {
          if (err) return log('\nFailed to render comment - ' + inspect(comment)
                              + '\nError: ' + inspect(err));
          everyone.now.receiveComment(html, comment.post._id);
        });
      };

      // update everyone with new trends
      var distributeTrends = function () {
        getTrending(10, function (err, media) {
          if (err) throw new Error('Failed to create trends');
          trends = media;
          var rendered = [];
          _.each(trends, function (trend) {
            rendered.push(templates.trend({ trend: trend }));
          });
          if (everyone.now.receiveTrends)
            everyone.now.receiveTrends(null, rendered);
        });
      };
      setInterval(distributeTrends, 5000); distributeTrends();
      
      // .server.socket.set('authorization', function (data, cb) {
      //   var cookies = connect.utils.parseCookie(data.headers.cookie);
      //   var sid = cookies['connect.sid'];
      //   app.settings.sessionStore.load(sid, function (err, sess) {
      //     if (err) {
      //       log("Error: Failed finding session", '(' + sid + ')');
      //       return cb(err);
      //     }
      //     if (!sess) {
      //       // log("Error: Invalid session", '(sid:' + sid + ')');
      //       return cb(new Error('Could not find session'));
      //     }
      //     log("Session opened", '(sid:' + sid + ')');
      //     data.session = sess;
      //     cb(null, true);
      //   });
      //   // TODO: Keep the session alive on with a timeout.
      // });

      log("Express server listening on port", app.address().port);
    }
  );
}
