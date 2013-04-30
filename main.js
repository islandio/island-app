#!/usr/bin/env node
/*
 * main.js: Entry point for the Island app.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 3644)
    .describe('dburi', 'Mongo database name')
      .default('dburi', 'island')
    .describe('index', 'Ensure indexes on MongoDB collections'
        + '(always `true` in production)')
      .boolean('index')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var express = require('express');
var mongodb = require('mongodb');
var redis = require('redis');
var RedisStore = require('connect-redis')(express);
var Pusher = require('pusher');
var request = require('request');
var jade = require('jade');
var stylus = require('stylus');
var passport = require('passport');
var util = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Connection = require('./lib/db.js').Connection;
var resources = require('./lib/resources');
var Mailer = require('./lib/mailer');

// Setup Environments
var app = express();

// App port is env var in production
app.set('PORT', process.env.PORT || argv.port);

// Facebook params
app.set('facebook', {
  clientID: 203397619757208,
  clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2'
});

// Twitter params
app.set('twitter', {
  consumerKey: 'ithvzW8h1tEsUBewL3jxQ',
  consumerSecret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8'
});

// Grade map
app.set('GRADES', ['9c+', '9c', '9b+', '9b', '9a+', '9a', '8c+', '8c',
    '8b+', '8b', '8a+', '8a', '7c+', '7c', '7b+', '7b', '7a+', '7a',
    '6c+', '6c', '6b+', '6b', '6a+', '6a', '5c', '5b', '5a', '4', '3']);

Step(
  function () {

    // Development only
    if ('development' === app.get('env')) {

      // App params
      app.set('HOME_URI', 'http://local.island.io:' + app.get('PORT'));
      app.set('MONGO_URI', 'mongodb://localhost:27018/' + argv.dburi);
      app.set('REDIS_HOST', 'localhost');
      app.set('REDIS_PORT', 6379);
      app.set('CHANNELS', {all: 'island_test'});

      // Instagram params
      app.set('instagram', {
        clientID: 'b6e0d7d608a14a578cf94763f70f1b49',
        clientSecret: 'a3937ee32072457d92eaa2165bd7dd37',
        callbackURL: app.get('HOME_URI') + '/members/connect/instagram/callback',
        verify: 'doesthisworkyet'
      });

      // Transloadit params
      app.set('transloadit', {
        media: {
          auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
          template_id: '29c60cfc5b9f4e8b8c8bf7a9b1191147'
        },
        profile: {
          auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
          template_id: '396d7cb3a2a5437eb258c3e86000f3bf'
        }
      });

      // CloudFront URIs
      app.set('cloudfront', {
        img: 'https://d2a89oeknmk80g.cloudfront.net/',
        vid: 'https://d2c2zu8qn6mgju.cloudfront.net/',
        aud: 'https://d2oapa8usgizyg.cloudfront.net/'
      });

      // Redis connect
      this(null, redis.createClient(app.get('REDIS_PORT'),
            app.get('REDIS_HOST')));
    }

    // Production only
    if ('production' === app.get('env')) {

      // App params
      app.set('HOME_URI', 'http://island.io');
      app.set('MONGO_URI', 'mongodb://nodejitsu:af8c37eb0e1a57c1e56730eb635f6093'
          + '@linus.mongohq.com:10020/nodejitsudb5582710115');
      app.set('REDIS_HOST', 'nodejitsudb2498459205.redis.irstack.com');
      app.set('REDIS_PASS', 'nodejitsudb2498459205.redis.irstack.com:'
          + 'f327cfe980c971946e80b8e975fbebb4');
      app.set('REDIS_PORT', 6379);
      app.set('CHANNELS', {all: 'island'});

      // Instagram params
      app.set('instagram', {
        clientID: 'a3003554a308427d8131cef13ef2619f',
        clientSecret: '369ae2fbc8924c158316530ca8688647',
        callbackURL: app.get('HOME_URI') + '/members/connect/instagram/callback',
        verify: 'doesthisworkyet'
      });

      // Transloadit params
      app.set('transloadit', {
        media: {
          auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
          template_id: 'dd77fc95cfff48e8bf4af6159fd6b2e7'
        },
        profile: {
          auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
          template_id: 'ddc4239217f34c8185178d2552f8ef9a'
        }
      });

      // CloudFront URIs
      app.set('cloudfront', {
        img: 'https://d1da6a4is4i5z6.cloudfront.net/',
        vid: 'https://d1ehvayr9dfk4s.cloudfront.net/',
        aud: 'https://dp3piv67f7p06.cloudfront.net/'
      });

      // Redis connect
      var rc = redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST'));
      rc.auth(app.get('REDIS_PASS'), _.bind(function (err) {
        this(err, rc);
      }, this));
    }

  },
  function (err, rc) {
    if (err) return util.error(err);

    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({
      store: new RedisStore({ client: rc, maxAge: 2592000000}),
      secret: '69topsecretislandshit69'
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(stylus.middleware({src: __dirname + '/public'}));

    // Development only
    if ('development' === app.get('env')) {
      app.use(express.static(__dirname + '/public'));
      app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
    }

    // Production only
    if ('production' === app.get('env')) {
      app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
      app.use(express.errorHandler());
    }

    // Init Mailer
    app.set('mailer', new Mailer({
      user: 'robot@island.io',
      password: 'I514nDr06ot',
      host: 'smtp.gmail.com',
      ssl: true,
      defaults: {from: 'Island <robot@island.io>'},
      BASE_URI: app.get('HOME_URI')
    }));

    // Init Pusher
    app.set('pusher', new Pusher({
      appId: '35474',
      key: 'c260ad31dfbb57bddd94',
      secret: 'b29cec4949ef7c0d14cd'
    }));

    if (!module.parent) {

      Step(
        function () {
          var ei = 'production' === app.get('env') || argv.index;
          new Connection(app.get('MONGO_URI'), {ensureIndexes: ei}, this);
        },
        function (err, db) {
          if (err) {
            util.error(err);
            process.exit(1);
            return;
          }

          // Attach a db ref to app.
          app.set('db', db);

          // Init resources.
          resources.init(app, function (err) {
            if (err)
              return util.error(err);
            util.log('Web and API server listening on port ' + app.get('PORT'));
          });

        }
      );

    }
  }

);


//   Step(
//     function () {
//       console.log('Connecting to MongoDB:', app.get('MONGO_URI'));
//       mongodb.connect(app.get('MONGO_URI'), {server: { poolSize: 4 }}, this);
//     },
//     function (err, db) {
//       if (err) return this(err);
      
//       new MemberDb(db, {
//         app: app,
//         ensureIndexes: argv.index,
//         redisClient: redisClient
//       }, this.parallel());
//       new EventDb(db, {
//         app: app,
//         ensureIndexes: argv.index,
//         pusher: pusher,
//       }, this.parallel());
//       new ClimbDb(db, {
//         app: app,
//         ensureIndexes: argv.index,
//         redisClient: redisClient
//       }, this.parallel());
//     },
//     function (err, mDb, eDb, cDb) {
//       if (err) return this(err);
//       memberDb = mDb;
//       eventDb = eDb;
//       eventDb.memberDb = memberDb;
//       climbDb = cDb;
//       this();
//     },
//     function (err) {
//       if (err) return this(err);

//       // init express
//       app.listen(argv.port, function () {
//         console.log('Server listening on port ' + argv.port);
//       });

//       // Create service subscriptions
//       request.post({
//         uri: 'https://api.instagram.com/v1/subscriptions',
//         form: {
//           client_id: instagramCredentials.clientID,
//           client_secret: instagramCredentials.clientSecret,
//           object: 'user',
//           aspect: 'media',
//           verify_token: instagramVerifyToken,
//           callback_url: process.env.NODE_ENV === 'production' ?
//                           'http://island.io/publish/instagram' :
//                           'https://please.showoff.io/publish/instagram'
//         }
//       }, function (err, res, body) {
//         if (err)
//           return console.log(inspect(err));
//         if (res.statusCode === 200)
//           console.log('Subscribed to connected Instagram users (id ' + JSON.parse(body).data.id + ')');
//         else
//           console.log('Instagram subscription failed', body);
//       });

//       // TODO: don't do it like this
//       findTwitterHandles();
//     }
//   );
// }


// var templateUtil = {
//   formatCommentText: function (str) {
//     var linkExp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
//     str = str.replace(/\n/g, '<br/>');
//     str = str.replace(linkExp,"<a href='$1' target='_blank'>$1</a>");
//     return str;
//   },

//   isValidDate: function (d) {
//     if (Object.prototype.toString.call(d) !== '[object Date]')
//       return false;
//     return !isNaN(d.getTime());
//   },

//   ratingMap: {
//     1: '3', 2: '4', 3: '5a', 4: '5b', 5: '5c', 6: '6a',  7: '6a+', 8: '6b',
//     9: '6b+', 10: '6c', 11: '6c+', 12: '7a', 13: '7a+', 14: '7b', 15: '7b+',
//     16: '7c', 17: '7c+', 18: '8a', 19: '8a+', 20: '8b', 21: '8b+', 22: '8c',
//     23: '8c+', 24: '9a', 25: '9a+', 26: '9b', 27: '9b+', 28: '9c', 29: '9c+',
//   },
// };

////////////// Web Routes

// // Home
// app.get('/', function (req, res, next) {
//   Step(
//     function () {
//       findTrendingMedia(10, this);
//     },
//     function (err, trends) {
//       if (err) return next(err);
//       res.render('media', {
//         title: 'You\'re Island',
//         trends: trends,
//         member: req.user,
//         twitters: twitterHandles,
//       });
//     }
//   );
// });

// // Films
// app.get('/films', function (req, res) {
//   Step(
//     function () {
//       memberDb.findPosts({'product.sku': {$ne: null}}, this);
//     },
//     function (err, posts) {
//       _.each(posts, function (post) {
//         var img = [];
//         var vid = [];
//         var aud = [];
//         _.each(post.medias, function (med) {
//           var rating = req.user ? _.find(med.ratings, function (rat) {
//             return req.user._id.toString() === rat.member_id.toString();
//           }) : null;
//           med.hearts = rating ? rating.val : 0;
//           delete med.ratings;
//           switch (med.type) {
//             case 'image': img.push(med); break;
//             case 'video': vid.push(med); break;
//             case 'audio':
//               aud.push(med);
//               med.audioIndex = aud.length;
//               break;
//           }
//         });
//         post.medias = [].concat(img, aud, vid);
//       });
//       res.render('films', {
//         title: 'Island - Films',
//         films: posts,
//         member: req.user,
//         twitters: twitterHandles,
//         util: templateUtil
//       });
//     }
//   );
// });
// app.get('/film', function (req, res) {
//   res.redirect('/films');
// });

// // Explore
// app.get('/explore', function (req, res) {
//   res.render('explore', { title: 'Island - Explore'});
// });

// // Privacy Policy
// app.get('/privacy', function (req, res) {
//   res.render('privacy', { title: 'Privacy Policy'});
// });


// ////////////// Helpers

// function authorize(req, res, cb) {
//   var memberId = req.session.passport.user;
//   if (!memberId) {
//     req.session.referer = req.originalUrl;
//     return res.redirect('/login');
//   }
//   memberDb.findMemberById(memberId, true, function (err, member) {
//     if (err) return cb(err);
//     if (!member) {
//       req.session.passport = {};
//       res.redirect('/login');
//       return cb(new Error('Member and Session do NOT match'));
//     }
//     req.user = member;
//     cb(null, member);
//   });
// }
// function getGrid(query, opts, cb) {
//   if ('function' === typeof opts) {
//     cb = opts;
//     opts = { limit: 10, skip: 0 };
//   }
//   opts.sort = { created: -1 };
//   Step(
//     function () {
//       memberDb.findPosts(query, opts, this);
//     },
//     function (err, posts) {
//       if (err) return cb(err);
//       var media = [];
//       _.each(posts, function (post) {
//         _.each(post.medias, function (med) {
//           med.post = post;
//           med.index = null;
//           var match = _.find(post.medias, function (m, i) {
//             med.index = i;
//             return m._id.toString() === med._id.toString();
//           });
//         });
//         media = media.concat(post.medias);
//       });
//       cb(null, media);
//     }
//   );
// }
// function findTrendingMedia(limit, cb) {
//   Step(
//     function () {
//       memberDb.findPosts({}, { limit: 20, sort: { created: -1 }}, this);
//     },
//     function (err, posts) {
//       if (err) return cb(err);
//       var media = [];
//       _.each(posts, function (post) {
//         _.each(post.medias, function (med) {
//           med.vcnt = post.vcnt;
//           med.ccnt = post.ccnt;
//         });
//         media = media.concat(post.medias);
//       });
//       media.sort(function (a, b) {
//         return (b.vcnt + b.tcnt + b.hcnt + 10*b.ccnt)
//                 - (a.vcnt + a.tcnt + a.hcnt + 10*a.ccnt);
//       });
//       cb(null, _.first(media, limit));
//     }
//   );
// }
// function renderMedia(med, cb) {
//   cb(null, templates.object({ object: med }));
// }
// function renderComment(params, cb) {
//   cb(null, templates.comment(_.extend(params, { util: templateUtil })));
// }


// ////////////// Everyone methods

// // add new object to everyone's page
// function distributeGrid(id) {
//   Step(
//     function () {
//       getGrid({ _id: id }, { limit: 1}, this);
//     },
//     function (err, media) {
//       if (err) return fail(err);
//       _.each(media, function (med) {
//         renderMedia(med, function (err, html) {
//           if (err) return fail(err);
//           pusher.trigger(channels.all, 'media.read', { html: html });
//         });
//       });
//     }
//   );
//   function fail(err) {
//     console.log(inspect(err));
//   }
// };

// // add new comment to everyone's page
// function distributeComment(comment, member) {
//   var params = {
//     comment: comment,
//     showMember: true
//   };
//   renderComment(params, function (err, html) {
//     if (err) return console.log(inspect(err));
//     pusher.trigger(channels.all, 'comment.read', {
//       html: html,
//       id: comment.post._id,
//       mid: member._id
//     });
//   });
// };

// // tell everyone about some meta change
// function distributeUpdate(type, target, counter, id) {
//   if ('string' === typeof id)
//     id = new ObjectID(id);
//   var query = {};
//   var proj = {};
//   query['_id'] = id;
//   proj[counter] = 1;
//   Step(
//     function () {
//       var next = this;
//       memberDb.collections[target].findOne(query, proj,
//                                           function (err, doc) {
//         if (err) return fail(err);
//         next(null, doc[counter]);
//       });
//     },
//     function (err, count) {
//       if (err) return fail(err);
//       if ('media' === target)
//         return pusher.trigger(channels.all, 'update.read', {
//           ids: [id.toString()],
//           type: type,
//           count: count
//         });
//       memberDb.collections.media.find({ post_id: id })
//               .toArray(function (err, docs) {
//         if (err) return fail(err);
//         var ids = _.map(docs, function (doc) {
//                         return doc._id.toString(); });
//         pusher.trigger(channels.all, 'update.read', {
//           ids: ids,
//           type: type,
//           count: count
//         });
//       });
//     }
//   );
//   function fail(err) {
//     console.log(inspect(err));
//   }
// };
