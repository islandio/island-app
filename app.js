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
var url = require('url');
var log = require('./log.js').log;
var logTimestamp = require('./log.js').logTimestamp;

var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var color = require('cli-color');

var Notify = require('./notify');

var MemberDb = require('./member_db.js').MemberDb;

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;

var transloadit = { auth: { key: '8a36aa56062f49c79976fa24a74db6cc' }};
transloadit.template_id = process.env.NODE_ENV === 'production' ?
                            'dd77fc95cfff48e8bf4af6159fd6b2e7' :
                            '29c60cfc5b9f4e8b8c8bf7a9b1191147';

var cloudfrontImageUrl = process.env.NODE_ENV === 'production' ?
                            'https://d1da6a4is4i5z6.cloudfront.net/' :
                            'https://d2a89oeknmk80g.cloudfront.net/';
var cloudfrontVideoUrl = process.env.NODE_ENV === 'production' ?
                            'https://d1ehvayr9dfk4s.cloudfront.net/' :
                            'https://d2c2zu8qn6mgju.cloudfront.net/';
var cloudfrontAudioUrl = process.env.NODE_ENV === 'production' ?
                            'https://dp3piv67f7p06.cloudfront.net/' :
                            'https://d2oapa8usgizyg.cloudfront.net/';

var app = module.exports = express.createServer();
var everyone;

////////////// Utils

// TODO: Deal with this ugliness.
app.util = {
  formatCommentText: function (str) {
    var linkExp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    str = str.replace(/\n/g, '<br/>');
    str = str.replace(linkExp,"<a href='$1' target='_blank'>$1</a>");
    return str;
  },
};


////////////// Configuration

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
  app.use(express.errorHandler());
});

app.set('sessionStore', new mongoStore({
  db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
  username: 'islander',
  password: 'V[AMF?UV{b'
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


// Authentication methods

passport.serializeUser(function (member, cb) {
  cb(null, member._id.toString());
});

passport.deserializeUser(function (id, cb) {
  memberDb.findMemberById(id, function (err, member) {
    cb(err, member);
  });
});

passport.use(new FacebookStrategy({
    clientID: 203397619757208,
    clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2'
  },
  function (token, refreshToken, profile, cb) {
    profile.facebookToken = token;
    memberDb.findOrCreateMemberFromFacebook(profile,
        function (err, member) {
      cb(err, member);
    });
  }
));

passport.use(new TwitterStrategy({
    consumerKey: 'ithvzW8h1tEsUBewL3jxQ',
    consumerSecret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8'
  },
  function (token, tokenSecret, profile, cb) {
    profile.twitterToken = token;
    memberDb.findOrCreateMemberFromTwitter(profile,
          function (err, member) {
      cb(err, member);
    });
  }
));

passport.use(new LocalStrategy(
  function (email, password, cb) {
    memberDb.collections.member.findOne({ primaryEmail: email },
                                    function (err, member) {
      if (err) return cb(err);
      if (!member) return cb(null, false);
      if ('local' !== member.provider)
        return cb(null, false);
      if (!MemberDb.authenticateLocalMember(member, password))
        return cb(null, false);
      return cb(null, member);
    });
  }
));


////////////// Web Routes

// Home
app.get('/', authorize, function (req, res) {
  Step(
    function () {
      getMedia(100, this.parallel());
      getRecentComments(5, this.parallel());
    },
    function (err, media, comments, twitters) {
      res.render('index', {
        part: 'media',
        media: media,
        trends: mediaTrends,
        comments: comments,
        member: req.user,
        twitters: twitterHandles,
      });
    }
  );
});

// Landing page
app.get('/login', function (req, res) {
  var memberId = req.session.passport.user;
  if (memberId) return res.redirect('/');
  res.render('login');
});

// Basic password authentication
app.post('/login', function (req, res, next) {
  var missing = [];
  if (!req.body.username)
    missing.push('username');
  if (!req.body.password)
    missing.push('password');
  if (missing.length !== 0) {
    return res.send({
      status: 'fail', 
      data: { code: 'MISSING_FIELD', 
              message: 'All fields are required.',
              missing: missing },
    });
  }
  passport.authenticate('local', function (err, member, info) {
    if (err) return next(err);
    if (!member)
      return res.send({
        status: 'fail',
        data: {
          code: 'BAD_AUTH',
          message: 'Your email or password is incorrect.'
        }
      });
    if (!member.confirmed)
      return res.send({
        status: 'fail',
        data: {
          code: 'NOT_CONFIRMED',
          message: member.displayName + ', please confirm your account by '
                  + 'following the link in your confirmation email. '
                  + '<a href="javascript:;" id="noconf-' + member._id + '" class="resend-conf">'
                  + 'Re-send the confirmation email</a> if you need to.'
        }
      });
    req.logIn(member, function (err) {
      if (err) return next(err);
      var referer = url.parse(req.headers.referer);
      referer.search = referer.query = referer.hash = null;
      referer.pathname = '/';
      return res.send({
        status: 'success',
        data: { path: url.format(referer) }
      });
    });
  })(req, res, next);
});

// Facebook authentication
app.get('/auth/facebook', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  referer.pathname = '/auth/facebook/callback';
  var returnUrl = url.format(referer);
  referer.pathname = '/';
  var realm = url.format(referer);
  passport._strategies['facebook']._callbackURL = returnUrl;
  passport.authenticate('facebook', { scope: [
                        'email',
                        'user_about_me',
                        'user_birthday',
                        'user_website',
                        'user_status',
                        'user_photos']})(req, res, next);
});

// Facebook returns here
app.get('/auth/facebook/callback', function (req, res, next) {
  passport.authenticate('facebook', { successRedirect: '/',
                                    failureRedirect: '/login' })(req, res, next);
});

// Twitter authentication
app.get('/auth/twitter', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  referer.pathname = '/auth/twitter/callback';
  var returnUrl = url.format(referer);
  referer.pathname = '/';
  var realm = url.format(referer);
  passport._strategies['twitter']._oauth._authorize_callback = returnUrl;
  passport.authenticate('twitter')(req, res, next);
});

// Twitter returns here
app.get('/auth/twitter/callback', function (req, res, next) {
  passport.authenticate('twitter', { successRedirect: '/',
                                    failureRedirect: '/login' })(req, res, next);
});

// We logout via an ajax request.
app.get('/logout', function (req, res) {
  req.logOut();
  res.redirect('/');
});

// Create a new member with local authentication
app.put('/signup', function (req, res) {
  var missing = [];
  if (!req.body.newname)
    missing.push('newname');
  if (!req.body.newusername)
    missing.push('newusername');
  if (!req.body.newpassword)
    missing.push('newpassword');
  if (missing.length !== 0) {
    return res.send({
      status: 'fail', 
      data: { code: 'MISSING_FIELD',
              message: 'All fields are required.',
              missing: missing },
    });
  }
  var props = {
    primaryEmail: req.body.newusername,
    emails: [ { value: req.body.newusername } ],
    displayName: req.body.newname,
    password: req.body.newpassword,
    provider: 'local',
  };
  memberDb.findOrCreateMemberFromPrimaryEmail(props,
      { safe: true }, function (err, member) {
    if (err)
      return res.send({
        status: 'fail',
        data: {
          code: 'DUPLICATE_EMAIL',
          message: 'That email address is already in use.'
        }
      });
    var referer = url.parse(req.headers.referer);
    referer.search = referer.query = referer.hash = null;
    referer.pathname = '/';
    var confirm = path.join(url.format(referer), 'confirm', member._id.toString());
    Notify.welcome(member, confirm, function (err, msg) {
      if (err) return next(err);
      return res.send({
        status: 'success',
        data: {
          message: 'That\'s great, ' + member.displayName + '. We just sent you a message.'
                    + ' Please follow the enclosed link to confirm your account...'
                    + ' and thanks for checking out Island!',
          member: member,
        },
      });
    });
  });
});

// Confirm page
app.get('/confirm/:id', function (req, res, next) {
  if (!req.params.id)
    return res.render('404');
  memberDb.findMemberById(req.params.id, function (err, member) {
    if (err) return next(err);
    if (!member)
      return res.render('404');
    memberDb.collections.member.update({ _id: member._id },
                                      { $set : { confirmed: true }},
                                      { safe: true }, function (err, result) {
      if (err) return next(err);
      if (!result) return res.render('404');
      req.logIn(member, function (err) {
        if (err) return next(err);
        res.redirect('/');
      });
    });
  });
});

// Resend Confirmation Email
app.post('/resendconf/:id', function (req, res) {
  if (!req.params.id)
    return res.send({
      status: 'error',
      message: 'Invalid request.',
    });
  memberDb.findMemberById(req.params.id, function (err, member) {
    if (err) return next(err);
    if (!member)
      return res.send({
        status: 'error',
        message: 'Something went wrong. Please register again.',
      });
    var referer = url.parse(req.headers.referer);
    referer.search = referer.query = referer.hash = null;
    referer.pathname = '/';
    var confirm = path.join(url.format(referer), 'confirm', member._id.toString());
    Notify.welcome(member, confirm, function (err) {
      if (err) return next(err);
      return res.send({
        status: 'success',
        data: {
          message: 'That\'s great, ' + member.displayName + '. We just sent you a message.'
                    + ' Please follow the enclosed link to confirm your account...'
                    + ' and thanks for checking out Island!',
          member: member,
        },
      });
    });
  });
});

// Add media form
app.get('/add', authorize, function (req, res) {
  if (req.user.role !== 0)
    return res.redirect('/');
  res.render('index', {
    part: 'add',
    tlip: transloadit,
    member: req.user,
    twitters: twitterHandles,
  });
});

// Media search
app.get('/search/:query', authorize, function (req, res) {
  var fn = '__clear__' === req.params.query ?
            _.bind(getMedia, {}, 100) :
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
app.get('/member/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findMemberByKey(req.params.key, this.parallel());
      getMedia(100, this.parallel());
    },
    function (err, member, media) {
      if (err || !member || member.role !== 0)
        return res.render('404');
      getRecentComments(5, member._id, function (err, coms) {
        if (err)
          return res.render('500');
        res.render('index', {
        part: 'profile',
        data: member,
        comments: coms,
        grid: media,
        twitters: twitterHandles,
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
      getMedia(100, this.parallel());
    },
    function (err, post, grid) {
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
      var img = [];
      var vid = [];
      var aud = [];
      _.each(post.medias, function (med) {
        var rating = _.find(med.ratings.reverse(), function (rat) {
          return req.user._id.toString() === rat.member_id.toString();
        });
        med.hearts = rating ? rating.val : 0;
        switch (med.type) {
          case 'image': img.push(med); break;
          case 'video': vid.push(med); break;
          case 'audio':
            aud.push(med);
            med.audioIndex = aud.length;
            break;
        }
      });
      post.medias = [].concat(img, aud, vid);
      _.each(post.comments, function (com) {
        delete com.post;
      });
      res.render('index', {
        part: 'single',
        post: post,
        grid: grid,
        member: req.user,
        twitters: twitterHandles,
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
      var _next = _.after(num, done);
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
            post_id: doc._id,
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
            everyone.distributeMedia(med);
            _next(null, doc);
          });
        });
      });
    }
  );
});

// Click media
app.put('/hit/:mediaId', authorize, function (req, res) {
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
app.put('/comment/:postId', authorize, function (req, res) {
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
app.put('/rate/:mediaId', authorize, function (req, res) {
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


////////////// Helpers

function authorize(req, res, cb) {
  var memberId = req.session.passport.user;
  if (!memberId) return res.redirect('/login');
  memberDb.findMemberById(memberId, function (err, member) {
    if (err) return cb(err);
    if (!member) {
      res.redirect('/login');
      return cb(new Error('Member and Session do NOT match'));
    }
    req.user = member;
    cb(null, member);
  });
}

function getMedia(limit, cb) {
  memberDb.findMedia({}, { limit: limit,
                    sort: { created: -1 } }, cb);
}
function findTrendingMedia(limit, cb) {
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

function renderMedia(med, cb) {
  cb(null, templates.object({ object: med }));
}

function renderComment(params, cb) {
  // HACK!!
  params.app = app;
  cb(null, templates.comment(params));
}


////////////// Initialize and Listen

var memberDb;
var mediaTrends;
var twitterHandles;

if (!module.parent) {

  Step(
    // Connect to MemberDb:
    function () {
      log('Connecting to MemberDb:', argv.db);
      mongodb.connect(argv.db, {server: { poolSize: 4 }}, this);
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
      var distributeTrendingMedia = function () {
        findTrendingMedia(10, function (err, media) {
          if (err) throw new Error('Failed to find media trends');
          mediaTrends = media;
          var rendered = [];
          _.each(mediaTrends, function (trend) {
            rendered.push(templates.trend({ trend: trend }));
          });
          if (everyone.now.receiveTrends)
            everyone.now.receiveTrends(null, rendered);
        });
      };
      setInterval(distributeTrendingMedia, 30000); distributeTrendingMedia();
      
      // get a current list of contributor twitter handles
      var findTwitterHandles = function () {
        memberDb.findTwitterHandles(function (err, handles) {
          if (err) throw new Error('Failed to find twitter handles');
          twitterHandles = handles;
        });
      };
      setInterval(findTwitterHandles, 60000); findTwitterHandles();

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
