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
 
var LOCAL = process.NODE_ENV !== 'production';

/**
 * Module dependencies.
 */
var express = require('express');
var connect = require('connect');
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

var Notify = require('./notify');

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


// Configuration

var app = module.exports = express.createServer();
var everyone;

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});

app.configure('production', function () {
  app.use(express.errorHandler());
  Notify.active = true;
});

app.set('sessionStore', new mongoStore({
  db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
}, function (err) {
  if (err) log('Error creating mongoStore: ' + err);
}));

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
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
  memberDb.findMedia({}, { limit: limit,
                    sort: { hits: -1 } }, cb);
}
function getRecentComments(limit, cb) {
  memberDb.findComments({}, { limit: limit,
                        sort: { created: -1 } }, cb);
}
function getTwitterNames(cb) {
  memberDb.findTwitterNames(cb);
}

function renderMedia(med, cb) {
  cb(null, templates.object({ object: med }));
}

function renderComment(com, cb) {
  cb(null, templates.comment({ comment: com }));
}


////////////// Web Routes

// Home
app.get('/', authorize, function (req, res) {
  Step(
    function () {
      getMedia(50, this.parallel());
      getTrending(5, this.parallel());
      getRecentComments(5, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, media, trends, comments, twitters) {
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
  passport.authenticate('facebook', { scope: ['email',
                        'user_status'] })(req, res, next);
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
            _.bind(memberDb.searchMedia, memberDb,
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


// Single object
app.get('/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findMedia({ key: req.params.key },
                        { limit: 1, hit: true }, this.parallel());
      getMedia(50, this.parallel());
      getTwitterNames(this.parallel());
    },
    function (err, med, media, twitters) {
      if (err || !med)
        return res.render('404');
      med = _.first(med);
      var rating = _.find(med.ratings.reverse(), function (rat) {
        return req.user._id.toString() === rat.member_id.toString();
      });
      _.each(med.comments, function (com) {
        delete com.media;
      });
      res.render('index', {
        part: 'single',
        media: med,
        hearts: rating ? rating.val : 0,
        grid: media,
        member: req.user,
        twitters: [],
      });
    }
  );
});


// Add media from transloadit.com
app.put('/insert', authorize, function (req, res, next) {
  var props = req.body.media;
  var results = req.body.assembly.results;
  props.member = req.user;

  if (req.body.assembly.results.image_thumb) {
    var attachment = {
      image_thumb: results.image_thumb['0'],
      image_full: results.image_full['0']
    }
    props.attached = attachment;
    props.type = props.attached.image_full.type;
    _.each(props.attached, function (att) {
      att.cf_url = cloudfrontImageUrl + att.id.substr(0, 2)
                    + '/' + att.id.substr(2) + '.' + att.ext; });
  } else if (results.video_encode) {
    var attachment = {
      video_thumbs: results.video_thumbs,
      video_placeholder: results.video_placeholder['0'],
      video_poster: results.video_poster['0'],
      video_encode: results.video_encode['0'],
    }
    props.attached = attachment;
    props.type = props.attached.video_encode.type;
    _.each(props.attached.video_thumbs, function (thu) {
      thu.cf_url = cloudfrontVideoUrl + thu.id.substr(0, 2)
                    + '/' + thu.id.substr(2) + '.' + thu.ext; });
    _.each([props.attached.video_placeholder,
    props.attached.video_poster,
    props.attached.video_encode], function (att) {
      att.cf_url = cloudfrontVideoUrl + att.id.substr(0, 2)
                    + '/' + att.id.substr(2) + '.' + att.ext; });
  }
  memberDb.createMedia(props, function (err, media) {
    if (err) return fail(err);
    everyone.now.distributeMedia(media);
    res.send({ status: 'success', data: {
             mediaId: media._id } });   
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});


// Add comment
app.put('/comment/:mediaId', function (req, res, next) {
  // TODO: permissions...
  var props = {
    media_id: req.params.mediaId,
    member_id: req.user._id,
    body: req.body.body,
  };
  memberDb.createComment(props, function (err, doc) {
    if (err) return fail(err);
    everyone.now.distributeComment(doc);
    res.send({ status: 'success', data: {
             comment: doc } });
  });  
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});


// Add rating
app.put('/rate/:mediaId', function (req, res, next) {
  // TODO: permissions...
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
      everyone.now.distributeMedia = function (media) {
        renderMedia(media, function (err, html) {
          if (err) return log('\nFailed to render media - ' + inspect(media)
                              + '\nError: ' + inspect(err));
          everyone.now.receiveMedia(html);
        });
      };

      // add new comment to everyone's page
      everyone.now.distributeComment = function (comment) {
        renderComment(comment, function (err, html) {
          if (err) return log('\nFailed to render comment - ' + inspect(comment)
                              + '\nError: ' + inspect(err));
          everyone.now.receiveComment(html, comment.media._id);
        });
      };

      // update everyone with new trends
      var distributeTrends = function () {
        getTrending(5, function (err, media) {
          var rendered = [];
          _.each(media, function (med) {
            rendered.push(templates.trend({ trend: med }));
          });
          if (everyone.now.receiveTrends)
            everyone.now.receiveTrends(null, rendered);
        });
      };
      setInterval(distributeTrends, 5000);
      
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
      //       return cb(new Error('Could not find session.'));
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





