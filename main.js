#!/usr/bin/env node

/**
 * Arguments.
 */
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('dev', 'Environment')
      .boolean('dev')
    .describe('port', 'Port to listen on')
      .default('port', 3644)
    .describe('db', 'MongoDb URL to connect to')
      .default('db', 'mongodb://nodejitsu:af8c37eb0e1a57c1e56730eb635f6093'
          + '@linus.mongohq.com:10020/nodejitsudb5582710115')
    .describe('redis_port', 'Redis port')
      .default('redis_port', 6379)
    .describe('redis_host', 'Redis host')
      .default('redis_host', 'nodejitsudb2498459205.redis.irstack.com')
    .describe('redis_pass', 'Redis password')
      .default('redis_pass', 'nodejitsudb2498459205.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4')
    .describe('index', 'Ensure indexes on MongoDB collections')
      .boolean('index')
    .argv;

if (argv.dev) {
  argv.db = 'mongodb://localhost:27018/island';
  argv.redis_host = 'localhost';
  argv.redis_port = 6379;
}

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

/**
 * Module dependencies.
 */
var express = require('express');
var mongodb = require('mongodb');
var redis = require('redis');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var request = require('request');

var stylus = require('stylus');
var jade = require('jade');
var templates = require('./templates');

var util = require('util'), debug = util.debug, inspect = util.inspect;
var fs = require('fs');
var path = require('path');
var url = require('url');

var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var Email = require('./email');

var RedisStore = require('connect-redis')(express);
var MemberDb = require('./member_db.js').MemberDb;
var EventDb = require('./event_db.js').EventDb;
var ClimbDb = require('./climb_db.js').ClimbDb;
var Pusher = require('pusher');

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
                              callbackURL: 'http://local.island.io:' + argv.port + '/connect/instagram/callback' };
var instagramVerifyToken = 'doesthisworkyet';

var app = express();
var sessionStore;
var memberDb;
var eventDb;
var climbDb;
var pusher;
var channels = process.env.NODE_ENV === 'production' ?
                {all: 'island'}:
                {all: 'island_test'};
var twitterHandles;

var grades = ['9c+', '9c', '9b+', '9b', '9a+', '9a', '8c+', '8c', '8b+', '8b',
              '8a+', '8a', '7c+', '7c', '7b+', '7b', '7a+', '7a', '6c+', '6c',
              '6b+', '6b', '6a+', '6a', '5c', '5b', '5a', '4', '3'];

////////////// Configuration

console.log('Connecting to Redis:', argv.redis_host + ':' + argv.redis_port);
var redisClient = redis.createClient(argv.redis_port, argv.redis_host);
if (argv.redis_pass && argv.redis_host !== 'localhost')
  redisClient.auth(argv.redis_pass, function (err) {
    console.log('Authenticated with Redis instance.')
    if (err) throw err;
  });

sessionStore = new RedisStore({
  client: redisClient,
  maxAge: 86400 * 1000 * 7
});

app.configure(function () {
  app.set('port', process.env.PORT || argv.port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + '/public/graphics/favicon.ico'));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    store: sessionStore,
    secret: '69topsecretislandshit69'
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(stylus.middleware({ src: __dirname + '/public' }));
});

app.configure('development', function () {
  app.set('home_uri', 'http://local.island.io:' + argv.port);
  Email.setHomeURI('http://local.island.io:' + argv.port);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
  app.set('home_uri', 'http://island.io');
  Email.setHomeURI('http://island.io');
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


////////////// Utils

var templateUtil = {
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
  },

  ratingMap: {
    1: '3', 2: '4', 3: '5a', 4: '5b', 5: '5c', 6: '6a',  7: '6a+', 8: '6b',
    9: '6b+', 10: '6c', 11: '6c+', 12: '7a', 13: '7a+', 14: '7b', 15: '7b+',
    16: '7c', 17: '7c+', 18: '8a', 19: '8a+', 20: '8b', 21: '8b+', 22: '8c',
    23: '8c+', 24: '9a', 25: '9a+', 26: '9b', 27: '9b+', 28: '9c', 29: '9c+',
  },
};

////////////// Web Routes

// Home
app.get('/', function (req, res, next) {
  Step(
    function () {
      findTrendingMedia(10, this);
    },
    function (err, trends) {
      if (err) return next(err);
      res.render('media', {
        title: 'You\'re Island',
        trends: trends,
        member: req.user,
        twitters: twitterHandles,
      });
    }
  );
});

// Films
app.get('/films', function (req, res) {
  Step(
    function () {
      memberDb.findPosts({'product.sku': {$ne: null}}, this);
    },
    function (err, posts) {
      _.each(posts, function (post) {
        var img = [];
        var vid = [];
        var aud = [];
        _.each(post.medias, function (med) {
          var rating = req.user ? _.find(med.ratings, function (rat) {
            return req.user._id.toString() === rat.member_id.toString();
          }) : null;
          med.hearts = rating ? rating.val : 0;
          delete med.ratings;
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
      });
      res.render('films', {
        title: 'Island - Films',
        films: posts,
        member: req.user,
        twitters: twitterHandles,
        util: templateUtil
      });
    }
  );
});
app.get('/film', function (req, res) {
  res.redirect('/films');
});

// Explore
app.get('/explore', function (req, res) {
  res.render('explore', { title: 'Island - Explore'});
});

// Privacy Policy
app.get('/privacy', function (req, res) {
  res.render('privacy', { title: 'Privacy Policy'});
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
    opts = { limit: 10, skip: 0 };
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
      memberDb.findPosts({}, { limit: 20, sort: { created: -1 }}, this);
    },
    function (err, posts) {
      if (err) return cb(err);
      var media = [];
      _.each(posts, function (post) {
        _.each(post.medias, function (med) {
          med.vcnt = post.vcnt;
          med.ccnt = post.ccnt;
        });
        media = media.concat(post.medias);
      });
      media.sort(function (a, b) {
        return (b.vcnt + b.tcnt + b.hcnt + 10*b.ccnt)
                - (a.vcnt + a.tcnt + a.hcnt + 10*a.ccnt);
      });
      cb(null, _.first(media, limit));
    }
  );
}
function renderMedia(med, cb) {
  cb(null, templates.object({ object: med }));
}
function renderComment(params, cb) {
  cb(null, templates.comment(_.extend(params, { util: templateUtil })));
}


////////////// Everyone methods

// add new object to everyone's page
function distributeGrid(id) {
  Step(
    function () {
      getGrid({ _id: id }, { limit: 1}, this);
    },
    function (err, media) {
      if (err) return fail(err);
      _.each(media, function (med) {
        renderMedia(med, function (err, html) {
          if (err) return fail(err);
          pusher.trigger(channels.all, 'media.read', { html: html });
        });
      });
    }
  );
  function fail(err) {
    console.log(inspect(err));
  }
};

// add new comment to everyone's page
function distributeComment(comment, member) {
  var params = {
    comment: comment,
    showMember: true
  };
  renderComment(params, function (err, html) {
    if (err) return console.log(inspect(err));
    pusher.trigger(channels.all, 'comment.read', {
      html: html,
      id: comment.post._id,
      mid: member._id
    });
  });
};

// tell everyone about some meta change
function distributeUpdate(type, target, counter, id) {
  if ('string' === typeof id)
    id = new ObjectID(id);
  var query = {};
  var proj = {};
  query['_id'] = id;
  proj[counter] = 1;
  Step(
    function () {
      var next = this;
      memberDb.collections[target].findOne(query, proj,
                                          function (err, doc) {
        if (err) return fail(err);
        next(null, doc[counter]);
      });
    },
    function (err, count) {
      if (err) return fail(err);
      if ('media' === target)
        return pusher.trigger(channels.all, 'update.read', {
          ids: [id.toString()],
          type: type,
          count: count
        });
      memberDb.collections.media.find({ post_id: id })
              .toArray(function (err, docs) {
        if (err) return fail(err);
        var ids = _.map(docs, function (doc) {
                        return doc._id.toString(); });
        pusher.trigger(channels.all, 'update.read', {
          ids: ids,
          type: type,
          count: count
        });
      });
    }
  );
  function fail(err) {
    console.log(inspect(err));
  }
};

// get a current list of contributor twitter handles
// TODO: Use the Twitter realtime API instead
function findTwitterHandles() {
  memberDb.findTwitterHandles(function (err, handles) {
    if (err) return console.warn('Failed to find twitter handles');
    twitterHandles = handles;
  });
};


////////////// Connect and Listen

if (!module.parent) {

  Step(
    function () {
      console.log('Connecting to MongoDB:', argv.db);
      mongodb.connect(argv.db, {server: { poolSize: 4 }}, this);
    },
    function (err, db) {
      if (err) return this(err);
      pusher = new Pusher({
        appId: '35474',
        key: 'c260ad31dfbb57bddd94',
        secret: 'b29cec4949ef7c0d14cd'
      });
      new MemberDb(db, {
        app: app,
        ensureIndexes: argv.index,
        redisClient: redisClient
      }, this.parallel());
      new EventDb(db, {
        app: app,
        ensureIndexes: argv.index,
        pusher: pusher,
      }, this.parallel());
      new ClimbDb(db, {
        app: app,
        ensureIndexes: argv.index,
        redisClient: redisClient
      }, this.parallel());
    },
    function (err, mDb, eDb, cDb) {
      if (err) return this(err);
      memberDb = mDb;
      eventDb = eDb;
      eventDb.memberDb = memberDb;
      climbDb = cDb;
      this();
    },
    function (err) {
      if (err) return this(err);

      // init express
      app.listen(argv.port, function () {
        console.log('Server listening on port ' + argv.port);
      });

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
      }, function (err, res, body) {
        if (err)
          return console.log(inspect(err));
        if (res.statusCode === 200)
          console.log('Subscribed to connected Instagram users (id ' + JSON.parse(body).data.id + ')');
        else
          console.log('Instagram subscription failed', body);
      });

      // TODO: don't do it like this
      findTwitterHandles();
    }
  );
}
