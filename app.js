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
var http = require('http');
var express = require('express');
var now = require('now');
var mongodb = require('mongodb');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var mongoStore = require('connect-mongodb');
var request = require('request');

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

var Notify = require('./notify');

var MemberDb = require('./member_db.js').MemberDb;

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;

var InstagramStrategy = require('passport-instagram').Strategy;

var transloaditMediaParams = { auth: { key: '8a36aa56062f49c79976fa24a74db6cc' }};
transloaditMediaParams.template_id = process.env.NODE_ENV === 'production' ?
                            'dd77fc95cfff48e8bf4af6159fd6b2e7' :
                            '29c60cfc5b9f4e8b8c8bf7a9b1191147';

var transloaditProfileParams = { auth: { key: '8a36aa56062f49c79976fa24a74db6cc' }};
transloaditProfileParams.template_id = process.env.NODE_ENV === 'production' ?
                            'ddc4239217f34c8185178d2552f8ef9a' :
                            '396d7cb3a2a5437eb258c3e86000f3bf';

var cloudfrontImageUrl = process.env.NODE_ENV === 'production' ?
                            'https://d1da6a4is4i5z6.cloudfront.net/' :
                            'https://d2a89oeknmk80g.cloudfront.net/';
var cloudfrontVideoUrl = process.env.NODE_ENV === 'production' ?
                            'https://d1ehvayr9dfk4s.cloudfront.net/' :
                            'https://d2c2zu8qn6mgju.cloudfront.net/';
var cloudfrontAudioUrl = process.env.NODE_ENV === 'production' ?
                            'https://dp3piv67f7p06.cloudfront.net/' :
                            'https://d2oapa8usgizyg.cloudfront.net/';

var instagramCredentials = process.env.NODE_ENV === 'production' ?
                            { clientID: 'a3003554a308427d8131cef13ef2619f',
                              clientSecret: '369ae2fbc8924c158316530ca8688647',
                              callbackURL: 'http://island.io/connect/instagram/callback' } :
                            { clientID: 'b6e0d7d608a14a578cf94763f70f1b49',
                              clientSecret: 'a3937ee32072457d92eaa2165bd7dd37',
                              callbackURL: 'http://local.island.io:3644/connect/instagram/callback' };
var instagramVerifyToken = 'doesthisworkyet';

var app = express.createServer();
var memberDb;
var everyone;
var mediaTrends;
var twitterHandles;

////////////// Utils

// TODO: Deal with this ugliness.
app.util = {
  formatCommentText: function (str) {
    var linkExp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    str = str.replace(/\n/g, '<br/>');
    str = str.replace(linkExp,"<a href='$1' target='_blank'>$1</a>");
    return str;
  },
  isValidDate: function (d) {
    if (Object.prototype.toString.call(d) !== '[object Date]')
      return false;
    return !isNaN(d.getTime());
  }
};


////////////// Configuration

app.configure(function () {
  app.set('port', process.env.PORT || argv.port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + '/public/graphics/favicon.ico'));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one week
    secret: '69topsecretislandshit69',
    store: new mongoStore({
      db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
      username: 'islander',
      password: 'V[AMF?UV{b'
    }, function (err) {
      if (err) log('Error creating mongoStore: ' + err);
    }),
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(stylus.middleware({ src: __dirname + '/public' }));
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
  app.use(express.errorHandler());
});

// Authentication methods

passport.serializeUser(function (member, cb) {
  cb(null, member._id.toString());
});

passport.deserializeUser(function (id, cb) {
  memberDb.findMemberById(id, true, function (err, member) {
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

passport.use('facebook-authz', new FacebookStrategy({
    clientID: 203397619757208,
    clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2'
  },
  function (token, refreshToken, profile, cb) {
    memberDb.collections.member.findOne({ facebookId: profile.id },
                                        function (err, member) {
      if (err) return cb(err);
      cb(null, member, {
        facebookToken: token,
        facebookId: profile.id,
        facebook: profile.username,
      });
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

passport.use('twitter-authz', new TwitterStrategy({
    consumerKey: 'ithvzW8h1tEsUBewL3jxQ',
    consumerSecret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8'
  },
  function (token, tokenSecret, profile, cb) {
    memberDb.collections.member.findOne({ twitterId: profile.id },
                                        function (err, member) {
      if (err) return cb(err);
      cb(null, member, {
        twitterToken: token,
        twitterId: profile.id,
        twitter: profile.username,
      });
    });
  }
));

passport.use(new LocalStrategy(
  function (email, password, cb) {
    memberDb.collections.member.findOne({ emails: { value: email }},
                                        function (err, member) {
      if (err) return cb(err);
      if (!member) return cb(null, false);
      if (!member.password)
        return cb(null, member, { waiting: true });
      if (!MemberDb.authenticateLocalMember(member, password))
        return cb(null, false);
      return cb(null, member);
    });
  }
));

passport.use('instagram-authz', new InstagramStrategy(
  instagramCredentials,
  function (token, refreshToken, profile, cb) {
    memberDb.collections.member.findOne({ instagramId: profile.id },
                                        function (err, member) {
      if (err) return cb(err);
      cb(null, member, {
        instagramToken: token,
        instagramId: profile.id,
        instagram: profile.username,
      });
    });
  }
));


////////////// Web Routes

// Home
app.get('/', authorize, function (req, res) {
  Step(
    function () {
      getGrid({}, this.parallel());
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
  if (req.session.passport.user)
    return res.redirect('/');
  var opts = { session: req.session.temp };
  delete req.session.temp;
  res.render('login', opts);
});

// Basic password authentication
app.post('/login', function (req, res, next) {
  var missing = [];
  if (!req.body.username)
    missing.push('username');
  if (!req.body.password)
    missing.push('password');
  if (missing.length !== 0)
    return res.send({
      status: 'fail', 
      data: { code: 'MISSING_FIELD',
              message: 'All fields are required.',
              missing: missing },
    });
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
    if (info && info.waiting) {
      missing.push('password');
      return res.send({
        status: 'fail',
        data: {
          code: 'ACCOUNT_WAITING',
          message: member.displayName
                  + ', Island underwent some changes since we last saw you. '
                  + 'To reactivate your account, please set a new password by '
                  + 'following the 1-step signup process using this '
                  + 'email address (' + member.primaryEmail + ').',
          missing: missing
        }
      });
    }
    // if (!member.confirmed)
    //   return res.send({
    //     status: 'fail',
    //     data: {
    //       code: 'NOT_CONFIRMED',
    //       message: member.displayName + ', please confirm your account by '
    //               + 'following the link in your confirmation email. '
    //               + '<a href="javascript:;" id="noconf-' + member._id + '" class="resend-conf">'
    //               + 'Re-send the confirmation email</a> if you need to.'
    //     }
    //   });
    req.logIn(member, function (err) {
      if (err) return next(err);
      var referer = url.parse(req.headers.referer);
      referer.search = referer.query = referer.hash = null;
      referer.pathname = '/';
      res.send({
        status: 'success',
        data: { path: url.format(req.session.referer || referer) },
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
  passport.authenticate('facebook', function (err, member, info) {
    if (err) return next(err);
    if (!member)
      return res.redirect('/login');
    if (!member.password) {
      req.session.temp = { provider: 'facebook', member: member };
      return res.redirect('/login');
    }
    req.logIn(member, function (err) {
      if (err) return next(err);
      res.redirect(req.session.referer || '/');
    });
  })(req, res, next); 
});

// Facebook authorization
app.get('/connect/facebook', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  req.session.referer = url.format(referer);
  referer.pathname = '/connect/facebook/callback';
  var returnUrl = url.format(referer);
  passport._strategies['facebook-authz']._callbackURL = returnUrl;
  passport.authorize('facebook-authz', { scope: [
                        'email',
                        'user_about_me',
                        'user_birthday',
                        'user_website',
                        'user_status',
                        'user_photos']})(req, res, next);
});

// Facebook authorization returns here
app.get('/connect/facebook/callback', function (req, res, next) {
  passport.authorize('facebook-authz', function (err, member, info) {
    if (err) return next(err);
    info.modified = true;
    memberDb.collections.member.update({ _id: req.user._id },
                                        { $set: info }, { safe: true },
                                        function (err) {
      if (err) return next(err);
      res.redirect(req.session.referer || '/');
    });
  })(req, res, next);
});

// Twitter authentication
app.get('/auth/twitter', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  referer.pathname = '/auth/twitter/callback';
  var returnUrl = url.format(referer);
  passport._strategies['twitter']._oauth._authorize_callback = returnUrl;
  passport.authenticate('twitter')(req, res, next);
});

// Twitter authentication returns here
app.get('/auth/twitter/callback', function (req, res, next) {
  passport.authenticate('twitter', function (err, member, info) {
    if (err) return next(err);
    if (!member)
      return res.redirect('/login');
    if (!member.password) {
      req.session.temp = { provider: 'twitter', member: member };
      return res.redirect('/login');
    }
    req.logIn(member, function (err) {
      if (err) return next(err);
      res.redirect(req.session.referer || '/');
    });
  })(req, res, next);
});

// Twitter authorization
app.get('/connect/twitter', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  req.session.referer = url.format(referer);
  referer.pathname = '/connect/twitter/callback';
  var returnUrl = url.format(referer);
  passport._strategies['twitter-authz']._oauth._authorize_callback = returnUrl;
  passport.authorize('twitter-authz')(req, res, next);
});

// Twitter authorization returns here
app.get('/connect/twitter/callback', function (req, res, next) {
  passport.authorize('twitter-authz', function (err, member, info) {
    if (err) return next(err);
    info.modified = true;
    memberDb.collections.member.update({ _id: req.user._id },
                                        { $set: info }, { safe: true },
                                        function (err) {
      if (err) return next(err);
      res.redirect(req.session.referer || '/');
    });
  })(req, res, next);
});

// Instagram authorization
app.get('/connect/instagram', function (req, res, next) {
  var referer = url.parse(req.headers.referer);
  referer.search = referer.query = referer.hash = null;
  req.session.referer = url.format(referer);
  referer.pathname = '/connect/instagram/callback';
  var returnUrl = url.format(referer);
  passport._strategies['instagram-authz']._callbackURL = returnUrl;
  passport.authorize('instagram-authz')(req, res, next);
});

// Instagram authorization returns here
app.get('/connect/instagram/callback', function (req, res, next) {
  passport.authorize('instagram-authz', function (err, member, info) {
    if (err) return next(err);
    info.modified = true;
    memberDb.collections.member.update({ _id: req.user._id },
                                        { $set: info }, { safe: true },
                                        function (err) {
      if (err) return next(err);
      res.redirect(req.session.referer || '/');
    });
  })(req, res, next);
});

// We logout via an ajax request.
app.get('/logout', function (req, res) {
  req.logOut();
  res.redirect('/');
});

// Create a new member with local authentication
app.put('/signup', function (req, res, next) {
  var missing = [];
  if (!req.body.newname)
    missing.push('newname');
  if (!req.body.newusername)
    missing.push('newusername');
  if (!req.body.newpassword)
    missing.push('newpassword');
  if (missing.length !== 0)
    return res.send({
      status: 'fail', 
      data: { code: 'MISSING_FIELD',
              message: 'All fields are required.',
              missing: missing },
    });
  req.body.newusername = req.body.newusername.toLowerCase();
  if (req.body.id) {
    Step(
      function () {
        var _this = this;
        memberDb.findMemberById(req.body.id, true, function (err, member) {
          if (err) return next(err);
          if (!member)
            return res.send({
              status: 'fail', 
              data: { code: 'INTERNAL_ERROR',
                      message: 'Oops! Something went wrong :( Please start over.' },
            });
          memberDb.collections.member.findOne({ emails: {
                                              value: req.body.newusername }},
                                              function (err, doc) {
            if (err) return next(err);
            if (doc && doc._id.toString() !== member._id.toString()) {
              // TEMP: match new admins with old accounts.
              if (doc.role === 0 && !doc.key) {
                memberDb.collections.member.remove({ _id: member._id },
                                                  { safe: true },
                                                  function (err, result) {
                  if (err) return next(err);
                  _.defaults(doc, member);
                  _this(null, doc);
                });
              } else return duplicate();
            } else _this(null, member);
          });
        });
      },
      function (err, member) {
        member.primaryEmail = req.body.newusername;
        var tempEmails = _.pluck(member.emails, 'value');
        if (!_.include(tempEmails, member.primaryEmail))
          member.emails.unshift({ value: member.primaryEmail });
        member.name = MemberDb.getMemberNameFromDisplayName(req.body.newname);
        member.displayName = member.name.givenName + (member.name.middleName ?
                            ' ' + member.name.middleName : '') +
                            ' ' + member.name.familyName;
        member.username = (member.name.givenName + (member.name.middleName || '')
                          + member.name.familyName).toLowerCase();
        member.password = req.body.newpassword;
        MemberDb.dealWithPassword(member);
        memberDb.collections.member.update({ _id: member._id },
                                            member, { safe: true },
                                            function (err) {
          if (err) return next(err);
          req.logIn(member, function (err) {
            if (err) return next(err);
            sendMessage(member);
          });
        });
      }
    );
  } else {
    var props = {
      primaryEmail: req.body.newusername,
      emails: [ { value: req.body.newusername } ],
      displayName: req.body.newname,
      password: req.body.newpassword,
      provider: 'local',
    };
    memberDb.findOrCreateMemberFromEmail(props,
        { safe: true }, function (err, member) {
      if (err)
        return duplicate();
      req.logIn(member, function (err) {
        if (err) return next(err);
        sendMessage(member);
      });
    });
  }
  function sendMessage(member) {
    var referer = url.parse(req.headers.referer);
    referer.search = referer.query = referer.hash = null;
    referer.pathname = '/';
    var confirm = path.join(url.format(referer), 'confirm', member._id.toString());
    Notify.welcome(member, confirm, function (err, msg) {
      if (err) return next(err);
      res.send({
        status: 'success',
        data: {
          path: url.format(req.session.referer || referer),
          // message: 'Cool, ' + member.displayName + '. We just sent you a message.'
          //           + ' Please follow the enclosed link to confirm your account ...'
          //           + ' and thanks for checking out Island!',
          member: member,
        },
      });
    });
  }
  function duplicate() {
    res.send({
      status: 'fail',
      data: {
        code: 'DUPLICATE_EMAIL',
        message: 'That email address is already in use.'
      },
    });
  }
});

// Confirm page
app.get('/confirm/:id', function (req, res, next) {
  if (!req.params.id)
    return res.render('404');
  memberDb.findMemberById(req.params.id, true, function (err, member) {
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
app.post('/resendconf/:id', authorize, function (req, res) {
  if (!req.params.id)
    return res.send({
      status: 'error',
      message: 'Invalid request.',
    });
  memberDb.findMemberById(req.params.id, true, function (err, member) {
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
      res.send({
        status: 'success',
        data: {
          message: 'Cool, ' + member.name.givenName + '. We just sent you a message.'
                    + ' Please follow the enclosed link to confirm your account...'
                    + ' then you can comment and stuff.',
          member: member,
        },
      });
    });
  });
});

// pagination
app.post('/page/:n', authorize, function (req, res) {
  if (!req.params.n)
    return res.send({
      status: 'error',
      message: 'Invalid request.',
    });
  getGrid({}, { limit: 30, skip: 30 * (req.params.n - 1)},
          function (err, docs) {
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

// Add media form
app.get('/add', authorize, function (req, res) {
  if (req.user.role !== 0)
    return res.redirect('/');
  res.render('index', {
    part: 'add',
    transloaditParams: transloaditMediaParams,
    member: req.user,
    twitters: twitterHandles,
  });
});

// Media search
app.get('/search/:query', authorize, function (req, res) {
  var fn = '__clear__' === req.params.query ?
            _.bind(getGrid, {}, {}) :
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

// Member profile
app.get('/member/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findMemberByKey(req.params.key, this.parallel());
      getGrid({}, this.parallel());
    },
    function (err, member, media) {
      if (err || !member)
        return res.render('404');
      getRecentComments(5, member._id, function (err, coms) {
        if (err)
          return res.render('500');
        _.each(member, function (v, k) {
          if (v === '') member[k] = null;
        });
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

// Edit member profile and settings
app.get('/settings/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findMemberByKey(req.params.key, this.parallel());
      getGrid({}, this.parallel());
    },
    function (err, member, media) {
      if (err || !member || member._id.toString()
          !== req.user._id.toString())
        return res.render('404');
      _.each(member, function (v, k) {
        if (v === '') member[k] = null;
      });
      res.render('index', {
        part: 'settings',
        data: member,
        transloaditParams: transloaditProfileParams,
        grid: media,
        twitters: twitterHandles,
        member: req.user,
      });
    }
  );
});

// Save member settings
app.put('/save/settings', authorize, function (req, res) {
  if (!req.body.member || !req.body.member.primaryEmail
      || !req.body.member.username || req.body.member._id
      !== req.user._id.toString())
    return done(new Error('Failed to save member settings'));
  var member = req.body.member;
  var assembly = req.body.member.assembly ?
                  JSON.parse(req.body.member.assembly) : null;
  function done(err) {
    if (err)
      return res.send({
        status: 'error',
        data: 'string' === typeof err ?
              null : err.data || err.stack,
      });
    res.send({ status: 'success' });
  }
  Step(
    function () {
      memberDb.findMemberById(req.user._id, true, this.parallel());
      memberDb.collections.member.findOne({ emails: { value: member.primaryEmail }},
                                          this.parallel());
      memberDb.collections.member.findOne({ $or: [{ username: member.username },
                                          { key: member.username }]}, this.parallel());
    },
    function (err, doc, byEmail, byUsername) {
      if (err) return done(err);
      if (!doc) return done('Could not find member');
      if (byEmail && byEmail._id.toString() !== doc._id.toString())
        return done({ data: { inUse: 'primaryEmail' }});
      if (byUsername && byUsername._id.toString() !== doc._id.toString())
        return done({ data: { inUse: 'username' }});
      doc.username = member.username;
      var tempEmails = _.pluck(doc.emails, 'value');
      if (!_.include(tempEmails, member.primaryEmail))
        doc.emails.unshift({ value: member.primaryEmail });
      doc.primaryEmail = member.primaryEmail;
      doc.displayName = member.displayName;
      doc.name = MemberDb.getMemberNameFromDisplayName(doc.displayName);
      if (assembly) {
        doc.image = assembly.results.image_full[0];
        doc.image.cf_url = cloudfrontImageUrl
                            + doc.image.id.substr(0, 2)
                            + '/' + doc.image.id.substr(2)
                            + '.' + doc.image.ext;
        doc.thumbs = assembly.results.image_thumb;
        _.each(doc.thumbs, function (thumb) {
          thumb.cf_url = cloudfrontImageUrl
                          + thumb.id.substr(0, 2)
                          + '/' + thumb.id.substr(2)
                          + '.' + thumb.ext;
        });
      }
      if (member.bannerLeft !== '') {
        doc.image.meta.left = member.bannerLeft * (640/232);
        doc.thumbs[0].meta.left = member.bannerLeft;
      }
      if (member.bannerTop !== '') {
        doc.image.meta.top = member.bannerTop * (640/232);
        doc.thumbs[0].meta.top = member.bannerTop;
      }
      doc.description = member.description;
      if (doc.location)
        doc.location.name = member.location;
      else
        doc.location = { name: member.location };
      if (doc.hometown)
        doc.hometown.name = member.hometown;
      else
        doc.hometown = { name: member.hometown };
      if ('' !== member.birthday) {
        var birthday = new Date(member.birthday);
        if (!app.util.isValidDate(birthday))
          return done({ data: { invalid: 'birthday' }});
        
        var month = String(birthday.getMonth() + 1);
        if (month.length < 2) month = '0' + month;
        var date = String(birthday.getDate());
        if (date.length < 2) date = '0' + date;
        var year = String(birthday.getFullYear());
        doc.birthday = month + '/' + date + '/' + year;
      }
      doc.gender = member.gender;
      var urls = member.website.match(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig);
      doc.website = '';
      _.each(urls, function (url, i) {
        doc.website += url;
        if (i !== urls.length - 1)
          doc.website += '\n';
      });
      doc.twitter = member.twitter;
      doc.modified = true;
      memberDb.collections.member.update({ _id: doc._id },
                                          doc, { safe: true }, done);
    }
  );
});

// Single object
app.get('/:key', authorize, function (req, res) {
  Step(
    function () {
      memberDb.findPosts({ key: req.params.key },
                        { limit: 1, comments: true },
                        this.parallel());
      getGrid({}, this.parallel());
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
        else everyone.distributeUpdate('view', 'post', doc.post_id);
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
  Step(
    function () {
      var post = req.body.post;
      post.member = req.user;
      memberDb.createPost(post, this);
    },
    function (err, doc) {
      if (err) return done(err);
      if (!doc) return done(new Error('Failed to create post'));
      var medias = [];
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
          if ('image_full' !== key && 'image_full_gif' !== key
              && 'video_encode' !== key
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
            case 'image_full_gif':
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
          medias.push(media);
        });
      });
      var _done = _.after(medias.length, done);
      _.each(medias, function (media) {
        memberDb.createMedia(media, function (err, med) {
          if (err) return done(err);
          _done(null, doc._id);
        });
      });
    }
  );
  function done(err, docId) {
    if (err)
      return res.send({ status: 'error',
                      message: err.stack });
    everyone.distributeGrid(docId);
    res.send({ status: 'success' });
  }
});

// Click media
app.put('/hit/:mediaId', authorize, function (req, res) {
  if (!req.params.mediaId)
    fail(new Error('Failed to hit media'));
  var props = {
    media_id: req.params.mediaId,
    member_id: req.user._id,
  };
  memberDb.createHit(props, function (err, doc) {
    if (err) return fail(err);
    everyone.distributeUpdate('hit', 'media', doc.media_id);
    res.send({ status: 'success' });
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});

// Add comment
app.put('/comment/:postId', authorize, function (req, res) {
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
    everyone.distributeUpdate('comment', 'post', doc.post._id);
    res.send({ status: 'success', data: {
             comment: doc } });
  });
  function fail(err) {
    if ('NOT_CONFIRMED' === err.code)
      res.send({
        status: 'fail',
        data: {
          code: err.code,
          message: err.member.name.givenName + ', please confirm your account by '
                  + 'following the link in your confirmation email. '
                  + '<a href="javascript:;" id="noconf-'
                  + err.member._id.toString() + '" class="resend-conf">'
                  + 'Re-send the confirmation email</a> if you need to.'
        }
      });
    else
      res.send({ status: 'error',
              message: err.stack });
  }
});

// Add rating
app.put('/rate/:mediaId', authorize, function (req, res) {
  if (!req.params.mediaId || !req.body.val)
    fail(new Error('Failed to insert rating'));
  var props = {
    media_id: req.params.mediaId,
    member_id: req.user._id,
    val: req.body.val,
  };
  memberDb.createRating(props, function (err, doc) {
    if (err) return fail(err);
    everyone.distributeUpdate('rating', 'media', doc.media_id);
    res.send({ status: 'success', data: {
             val: doc.val }});
  });
  function fail(err) {
    res.send({ status: 'error',
             message: err.stack });
  }
});

// Publish updates from Instagram
app.post('/publish/instagram', function (req, res) {
  if (!req.body.length)
    return res.end();
  var instagramUserIds = _.chain(req.body).pluck('object_id')
                          .reject(function (i) {return !i; }).value();
  if (instagramUserIds.length === 0)
    return res.end();
  Step(
    function () {
      var group = this.group();
      _.each(instagramUserIds, function (id) {
        memberDb.collections.member.findOne({ instagramId: id }, group());
      });
    },
    function (err, members) {
      if (err) return done(err);
      if (!members || !members.length)
        return done(new Error('Cannot find members from Instagram update'));
      var group = this.group();
      _.each(members, function (mem) {
        getInstagram(mem, group());
      });
    },
    function (err, instagrams) {
      if (err) return done(err);
      if (!instagrams || !instagrams.length)
        return done(new Error('Cannot find data from Instagram update'));
      var group = this.group();
      instagrams = _.filter(instagrams, function (ins) {
        return _.include(ins.tags, 'island');
      });
      if (!instagrams.length)
        return done(null, []);
      _.each(instagrams, function (instagram) {
        instagramToPost(instagram, group());
      });
    },
    function (err, postIds) {
      if (err) return done(err);
      done(null, postIds);
    }
  );
  function getInstagram(member, cb) {
    request.get({
      uri: 'https://api.instagram.com/v1/users/'
            + member.instagramId + '/media/recent',
      qs: {
        count: 1,
        access_token: member.instagramToken
      }
    }, function (err, response, body) {
      if (err) return cb(err);
      var instagram;
      if (body) {
        body = JSON.parse(body);
        instagram = _.first(body.data);
        instagram.member = member;
      }
      cb(null, instagram);
    });
  }
  function instagramToPost(data, cb) {
    Step(
      function () {
        memberDb.createPost({
          title: '@' + data.user.username,
          body: data.caption ? data.caption.text : '',
          location: data.location,
          member: data.member,
        }, this);
      },
      function (err, doc) {
        if (err) return cb(err);
        if (!doc) return cb(new Error('Failed to create post'));
        var media = {
          type: 'image',
          key: doc.key,
          post_id: doc._id,
          member_id: data.member._id,
        };
        delete data.member;
        media.image = {
          url: data.images.standard_resolution.url,
          meta: {
            width: data.images.standard_resolution.width,
            height: data.images.standard_resolution.height,
          },
        };
        media.thumbs = [
          {
            url: data.images.low_resolution.url,
            meta: {
              width: data.images.low_resolution.width,
              height: data.images.low_resolution.height,
            },
          },
          {
            url: data.images.thumbnail.url,
            meta: {
              width: data.images.thumbnail.width,
              height: data.images.thumbnail.height,
            },
          }
        ];
        delete data.images;
        media.instagram = data;
        memberDb.createMedia(media, function (err, med) {
          cb(err, doc._id);
        });
      }
    );
  }
  function done(err, docIds) {
    if (err) {
      log(inspect(err));
      return res.end();
    }
    _.each(docIds, function (id) {
      everyone.distributeGrid(id);
    });
    res.end();
  }
});

app.get('/publish/instagram', function (req, res) {
  if (instagramVerifyToken !== req.query['hub.verify_token']
      || 'subscribe' !== req.query['hub.mode']
      || '' === req.query['hub.challenge']) {
    log('Instagram subscription challenge attempt failed');
    return res.end();
  }
  log('Instagram subscription challenge accepted');
  res.send(req.query['hub.challenge']);
});

////////////// Helpers

function authorize(req, res, cb) {
  var memberId = req.session.passport.user;
  if (!memberId) {
    req.session.referer = req.originalUrl;
    return res.redirect('/login');
  }
  memberDb.findMemberById(memberId, true, function (err, member) {
    if (err) return cb(err);
    if (!member) {
      req.session.passport = {};
      res.redirect('/login');
      return cb(new Error('Member and Session do NOT match'));
    }
    req.user = member;
    cb(null, member);
  });
}
function getGrid(query, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = { limit: 30, skip: 0 };
  }
  opts.sort = { created: -1 };
  Step(
    function () {
      memberDb.findPosts(query, opts, this);
    },
    function (err, posts) {
      if (err) return cb(err);
      var media = [];
      _.each(posts, function (post) {
        _.each(post.medias, function (med) {
          med.hearts = 0;
          _.each(med.ratings, function (rat) {
            med.hearts += Number(rat.val);
          });
          med.post = post;
          med.index = null;
          var match = _.find(post.medias, function (m, i) {
            med.index = i;
            return m._id.toString() === med._id.toString();
          });
        });
        media = media.concat(post.medias);
      });
      cb(null, media);
    }
  );
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
      cb(null, _.first(media, limit));
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


////////////// Connect and Listen

if (!module.parent) {

  Step(
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

    function (err) {
      if (err) return this(err);

      // init express
      app.listen(argv.port, function () {
        console.log("Server listening on port " + argv.port);
      });

      // init now
      everyone = now.initialize(app);

      // add new object to everyone's page
      everyone.distributeGrid = function (id) {
        Step(
          function () {
            getGrid({ _id: id }, { limit: 1}, this);
          },
          function (err, media) {
            if (err) return fail(err);
            _.each(media, function (med) {
              renderMedia(med, function (err, html) {
                if (err) return fail(err);
                everyone.now.receiveMedia(html);
              });
            });
          }
        );
        function fail(err) {
          log('\nAt distributeGrid(' + id.toString() + ')'
              + '\nError: ' + inspect(err));
        }
      };

      // add new comment to everyone's page
      everyone.distributeComment = function (comment) {
        renderComment({ comment: comment, showMember: true },
                      function (err, html) {
          if (err) return log('\ndistributeComment ('
                              + inspect(comment) + ')'
                              + '\nError: ' + inspect(err));
          everyone.now.receiveComment(html, comment.post._id);
        });
      };

      // tell everyone about some meta change
      everyone.distributeUpdate = function (type, target, id) {
        if ('string' === typeof id)
          id = new ObjectID(id);
        var query = {};
        query[target + '_id'] = id;
        Step(
          function () {
            var next = this;
            if ('rating' !== type)
              memberDb.collections[type].count(query, this);
            else
              memberDb.collections[type].find(query)
                      .toArray(function (err, docs) {
                if (err) return fail(err);
                next(null, _.reduce(_.pluck(docs, 'val'),
                      function (m, n) { return m + Number(n); }, 0));
              });
          },
          function (err, count) {
            if (err) return fail(err);
            if ('media' === target)
              return everyone.now.receiveUpdate([id.toString()], type, count);
            memberDb.collections.media.find({ post_id: id })
                    .toArray(function (err, docs) {
              if (err) return fail(err);
              var ids = _.map(docs, function (doc) {
                              return doc._id.toString(); });
              everyone.now.receiveUpdate(ids, type, count);
            });
          }
        );
        function fail(err) {
          log('\ndistributeUpdate (' + type + ', '
              + target + ',' + id.toString() + ')'
              + '\nError: ' + inspect(err));
        }
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
      setInterval(distributeTrendingMedia, 30000);
      distributeTrendingMedia();
      
      // get a current list of contributor twitter handles
      // TODO: Use the Twitter realtime API instead
      var findTwitterHandles = function () {
        memberDb.findTwitterHandles(function (err, handles) {
          if (err) throw new Error('Failed to find twitter handles');
          twitterHandles = handles;
        });
      };
      setInterval(findTwitterHandles, 60000); findTwitterHandles();

      // Create service subscriptions
      request.post({
        uri: 'https://api.instagram.com/v1/subscriptions',
        form: {
          client_id: instagramCredentials.clientID,
          client_secret: instagramCredentials.clientSecret,
          object: 'user',
          aspect: 'media',
          verify_token: instagramVerifyToken,
          callback_url: process.env.NODE_ENV === 'production' ?
                          'http://island.io/publish/instagram' :
                          'https://please.showoff.io/publish/instagram'
        }
      }, function (error, response, body) {
        if (error)
          return log(inspect(error));
        if (response.statusCode === 200)
          log('Subscribed to connected Instagram users (id ' + JSON.parse(body).data.id + ')');
        else
          log('Instagram subscription failed', body);
      });
    }
  );
}
