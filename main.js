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
      .default('port', 8000)
    .describe('index', 'Ensure indexes on MongoDB collections'
        + '(always `true` in production)')
      .boolean('index')
    .describe('jobs', 'Schedule jobs'
        + '(always `true` in production)')
      .boolean('jobs')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var fs = require('fs');
var http = require('http');
var express = require('express');
var slashes = require('connect-slashes');
var mongodb = require('mongodb');
var redis = require('redis');
var reds = require('reds');
var RedisStore = require('connect-redis')(express);
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
var service = require('./lib/service');
var Mailer = require('./lib/mailer');
var PubSub = require('./lib/pubsub').PubSub;

// Setup Environments
var app = express();

// Package info.
app.set('package', JSON.parse(fs.readFileSync('package.json', 'utf8')));

// App port is env var in production
app.set('PORT', process.env.PORT || argv.port);

// Add connection config to app.
_.each(require('./config').get(process.env.NODE_ENV), function (v, k) {
  app.set(k, v);
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
    if (process.env.NODE_ENV !== 'production') {

      // App params
      app.set('ROOT_URI', '');
      app.set('HOME_URI', 'http://localhost:' + app.get('PORT'));

      // Facebook params
      app.set('facebook', {
        name: 'Island (dev)',
        clientID: 153015724883386,
        clientSecret: '8cba32f72580806cca22306a879052bd'
      });

      // Instagram params
      app.set('instagram', {
        clientID: 'b6e0d7d608a14a578cf94763f70f1b49',
        clientSecret: 'a3937ee32072457d92eaa2165bd7dd37',
        callbackURL: app.get('HOME_URI') + '/members/connect/instagram/callback',
        verifyToken: 'doesthisworkyet',
        postCallbackURL: 'https://island.fwd.wf/api/instagram'
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

      // CartoDB params
      app.set('cartodb', {
        user: 'island',
        api_key: '883965c96f62fd219721f59f2e7c20f08db0123b',
        tables: {
          medias: 'medias_dev',
        }
      });

      // Job scheduling.
      app.set('SCHEDULE_JOBS', argv.jobs);

      // Redis connect
      this(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST')));
    }

    // Production only
    else {

      // App params
      app.set('ROOT_URI', [app.get('package').cloudfront,
        app.get('package').version].join('/'));
      app.set('HOME_URI', 'http://island.io');

      // Facebook params
      app.set('facebook', {
        name: 'Island',
        clientID: 203397619757208,
        clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2'
      });

      // Instagram params
      app.set('instagram', {
        clientID: 'a3003554a308427d8131cef13ef2619f',
        clientSecret: '369ae2fbc8924c158316530ca8688647',
        callbackURL: app.get('HOME_URI') + '/members/connect/instagram/callback',
        verifyToken: 'doesthisworkyet',
        postCallbackURL: 'http://island.io/api/instagram'
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

      // CartoDB params
      app.set('cartodb', {
        user: 'island',
        api_key: '883965c96f62fd219721f59f2e7c20f08db0123b',
        tables: {
          medias: 'medias',
        }
      });

      // Job scheduling.
      app.set('SCHEDULE_JOBS', true);

      // Redis connect
      var rc = redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST'));
      rc.auth(app.get('REDIS_PASS'), _.bind(function (err) {
        this(err, rc);
      }, this));
    }

  },
  function (err, rc) {
    if (err) return util.error(err);

    // Mailer init
    app.set('mailer', new Mailer({
      user: 'robot@island.io',
      password: 'I514nDr06ot',
      host: 'smtp.gmail.com',
      ssl: true
    }, app.get('HOME_URI')));

    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({
      store: new RedisStore({client: rc, maxAge: 2592000000}),
      secret: '69topsecretislandshit69'
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.methodOverride());

    // Development only
    if (process.env.NODE_ENV !== 'production') {
      app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
      app.use(stylus.middleware({src: __dirname + '/public'}));
      app.use(express.static(__dirname + '/public'));
      app.use(slashes(false));
      app.use(app.router);
      app.use(express.errorHandler({dumpExceptions: true, showStack: true}));

      // PubSub init
      app.set('pubsub', new PubSub({
        appId: '43905',
        key: '37fea545f4a0ce59464c',
        secret: '1015c7f661849f639e49'
      }, app.get('mailer')));
    }

    // Production only
    else {
      app.use(express.favicon(app.get('ROOT_URI') + '/img/favicon.ico'));
      app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
      app.use(slashes(false));
      app.use(app.router);
      app.use(express.errorHandler());

      // Force HTTPS
      // app.all('*', function (req, res, next) {
      //   if ((req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https')
      //     return next();
      //   res.redirect('https://' + req.headers.host + req.url);
      // });

      // PubSub init
      app.set('pubsub', new PubSub({
        appId: '35474',
        key: 'c260ad31dfbb57bddd94',
        secret: 'b29cec4949ef7c0d14cd'
      }, app.get('mailer')));
    }

    if (!module.parent) {

      Step(
        function () {
          new Connection(app.get('MONGO_URI'), {ensureIndexes: argv.index}, this);
        },
        function (err, connection) {
          if (err) {
            util.error(err);
            process.exit(1);
            return;
          }

          // Attach a connection ref to app.
          app.set('connection', connection);

          // Attach a reds ref to app.
          reds.client = rc;
          app.set('reds', reds);

          // Init resources.
          resources.init(app, this);
        },
        function (err) {
          if (err) return console.error(err);

          // Init service.
          service.routes(app);

          // Catch all.
          app.use(function (req, res) {
            res.render('base', {member: req.user, root: app.get('ROOT_URI')});
          });

          // Start server.
          http.createServer(app).listen(app.get('PORT'));
          util.log('Web and API server listening on port ' + app.get('PORT'));
        }
      );

    }
  }

);
