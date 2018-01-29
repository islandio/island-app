#!/usr/bin/env node
/*
 * main.js: Entry point for the Island app.
 *
 */

var _package_ = require('./package.json');
// var cluster = require('cluster');
var util = require('util');
// var cpus = require('os').cpus().length;
// var localtunnel = require('localtunnel');
// var optimist = require('optimist');
// var argv = optimist
//     .describe('help', 'Get help')
//     .describe('index', 'Ensure indexes on MongoDB collections')
//       .boolean('index')
//     .describe('tunnel', 'Setup an introspected tunnel')
//       .boolean('tunnel')
//     .argv;

// if (cluster.isMaster) {
//   var createWorkers = function (opts) {
//
//     // Create a worker for each CPU.
//     for (var i = 0; i < cpus; ++i) {
//       cluster.fork(opts);
//     }
//
//     // Listen for dying workers
//     cluster.on('exit', function (worker) {
//
//       // Replace the dead worker.
//       util.log('Worker ' + worker.id + ' died');
//       cluster.fork();
//     });
//   };
//
//   // Setup an outside tunnel to our localhost in development.
//   // We will pass this to the workers.
//   if (process.env.NODE_ENV !== 'production' && argv.tunnel) {
//     localtunnel(_package_.port, {subdomain: _package_.tunnel.subdomain}, function(err, tunnel) {
//       if (err) {
//         console.error(err);
//       } else {
//         util.log('Setting up tunnel from this machine to ' + tunnel.url);
//       }
//       createWorkers({tunnelURL: tunnel.url});
//     });
//   } else {
//     createWorkers();
//   }
// } else {
//
//   if (argv._.length || argv.help) {
//     optimist.showHelp();
//     process.exit(1);
//   }

  var http = require('http');
  var express = require('express');
  var bodyParser = require('body-parser');
  var cookieParser = require('cookie-parser');
  var serveStatic = require('serve-static');
  var favicon = require('serve-favicon');
  var session = require('express-session');
  var morgan = require('morgan');
  var expressErrorhandler = require('errorhandler');
  var methodOverride = require('method-override');
  var slashes = require('connect-slashes');
  var zmq = require('zmq');
  var socketio = require('socket.io');
  var redis = require('redis');
  var ioredis = require('socket.io-redis');
  var RedisStore = require('connect-redis')(session);
  var stylus = require('stylus');
  var passport = require('passport');
  var psio = require('passport.socketio');
  var Step = require('step');
  var iutil = require('@islandio/util');
  var loggly = require('loggly');
  var _ = require('underscore');
  var db = require('mongish');
  var Search = require('@islandio/search').Search;
  var collections = require('@islandio/collections').collections;
  var Events = require('@islandio/events').Events;
  var Emailer = require('@islandio/emailer').Emailer;
  var resources = require('./lib/resources').resources;
  var Client = require('./lib/client').Client;
  var Stripe = require('stripe');
  var SendOwl = require('sendowl-node').SendOwl;
  var Shipwire = require('shipwire-node').Shipwire;
  var Poet = require('poet');
  var service = require('./lib/service');

  var app = require('./app').init();

  app.set('package', _package_);

  // App port is env var in production.
  app.set('PORT', process.env.PORT || app.get('package').port);

  _.each(require('./config.json'), function (v, k) {
    app.set(k, process.env[k] || v);
  });

  /*
   * Error wrap JSON request.
   */
  var errorHandler = function (err, req, res, data, estr) {
    if (typeof data === 'string') {
      estr = data;
      data = null;
    }
    var isXhr =
        req.headers['user-agent'].indexOf('node-superagent') !== -1 || req.xhr;
    if (err || (!data && estr)) {
      var profile = {
        member: req.user,
        content: {page: null},
        root: app.get('ROOT_URI'),
        transloadit: service.transloadit(req)
      };
      if (err) {
        console.log('Error in errorHandler:', (err.stack || err));
        profile.error = err.error || err;
        if (isXhr) {
          res.status(profile.error.code || 500).send(iutil.client(profile));
        } else {
          res.status(profile.error.code || 500).render('500', iutil.client(profile));
        }
      } else {
        profile.error = {message: estr + ' not found'};
        if (isXhr) {
          res.status(404).send(iutil.client(profile));
        } else {
          res.status(404).render('404', iutil.client(profile));
        }
      }
      return true;
    } else {
      return false;
    }
  };

  Step(
    function () {

      // Development only
      if (process.env.NODE_ENV !== 'production') {

        // Use console for logging in dev
        app.set('log', console.log);

        app.set('ROOT_URI', '');
        app.set('HOME_URI', 'http://localhost:' + app.get('PORT'));
      }

      // Production only
      else {

        // Use loggly for logging in pro
        app.set('log', loggly.createClient({
          token: '3c1c11ae-fc39-4e80-b81c-310aaa7a955c',
          subdomain: 'theisland',
          tags: ['NodeJS'],
          json: true
        }));

        app.set('ROOT_URI', [app.get('package').builds.cloudfront, app.get('package').version].join('/'));
        app.set('HOME_URI', [app.get('package').protocol.name, app.get('package').domain].join('://'));
      }

      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'), app.get('REDIS_HOST_SESSION')));
    },
    function (err, rc, rp, rs) {
      if (err) {
        console.error(err);
        process.exit(1);
        return;
      }
      rc.on('error', console.error);
      rp.on('error', console.error);
      rs.on('error', console.error);

      app.set('db', db);
      app.set('emailer', new Emailer({
        db: db,
        user: app.get('GMAIL_USER'),
        password: app.get('GMAIL_PASSWORD'),
        from: app.get('GMAIL_FROM'),
        host: app.get('GMAIL_HOST'),
        ssl: app.get('GMAIL_SSL'),
        baseURI: app.get('HOME_URI'),
        mock: process.env.NODE_ENV !== 'production'
      }));
      app.set('events', new Events({
        db: db,
        sock: (function () {
          var client = zmq.socket('pub');
          client.connect(app.get('PUB_SOCKET_PORT'));
          return client;
        })(),
        emailer: app.get('emailer')
      }));
      app.set('errorHandler', errorHandler);

      app.set('views', __dirname + '/views');
      app.set('view engine', 'pug');
      app.set('sessionStore', new RedisStore({client: rc, ttl: 60*60*24*30}));
      app.set('sessionSecret', 'weareisland');
      app.set('cookieParser', cookieParser(app.get('sessionKey')));
      app.use(morgan('dev'));

      app.use(bodyParser.json());
      app.use(bodyParser.urlencoded({ extended: true }));
      app.use(app.get('cookieParser'));
      app.use(session({
        store: app.get('sessionStore'),
        secret: app.get('sessionSecret'),
        resave: true,
        key: 'express.sid',
        name: 'express.sid',
        saveUninitialized: true,
        cookie: {
          maxAge: 60*60*24*30*1000,
          secure: false
        }
      }));
      app.use(passport.initialize());
      app.use(passport.session());
      app.use(methodOverride());

      // Development only
      if (process.env.NODE_ENV !== 'production') {
        app.use(favicon(__dirname + '/public/img/favicon.ico'));
        app.use(stylus.middleware(__dirname + '/public'));
        app.use(serveStatic(__dirname + '/public'));
        app.use(slashes(false));
        app.use(expressErrorhandler({dumpExceptions: true, showStack: true}));
      }

      // Production only
      else {
        app.use(serveStatic(__dirname + '/public', {maxAge: 60*60*24*30*1000}));
        app.use(slashes(false));
        app.use(function (err, req, res, next) {
          if (!err) return next();
          console.error('Returning code 500', err);
          console.error(err.stack);
          res.status(500).render('500', {root: app.get('ROOT_URI')});
        });

        // Forward load balancer requests originating with http to https
        app.all('*', function (req, res, next) {
          var proto = req.get('x-forwarded-proto');
          if (!proto) {
            return next();
          }
          if (proto.toLowerCase() === 'https') {
            return next();
          }
          res.redirect(301, 'https://' + req.headers.host + req.url);
        });
      }

      // if (!module.parent) {

        Step(
          function () {

            // Open DB connection.
            new db.Connection(
              app.get('MONGO_URI'), {ensureIndexes: false}, this.parallel());

            app.set('cache', new Search({
              redisHost: app.get('REDIS_HOST_CACHE'),
              redisPort: app.get('REDIS_PORT')
            }, this.parallel()));
          },
          function (err, connection) {
            if (err) return this(err);

            if (_.size(collections) === 0) {
              return this();
            }
            _.each(collections, _.bind(function (c, name) {
              connection.add(name, c, this.parallel());
            }, this));
          },
          function (err) {
            if (err) return this(err);

            var poet = Poet(app, {
              posts: './blog/',
              postsPerPage: 5,
              metaFormat: 'json',
              routes: {
                '/blog/:post': 'post',
                '/blog/page/:page': 'page',
                '/blog/tag/:tag': '404',
                '/blog/category/:category': 'category'
              }
            });
            poet.init().then(_.bind(function () {
              app.set('poet', poet);
              this();
            }, this));
          },
          function (err) {
            if (err) {
              console.error(err);
              process.exit(1);
              return;
            }

            app.set('sharing', require('./lib/sharing'));

            app.set('stripe', Stripe(app.get('STRIPE_SECRET_KEY')));

            app.set('sendowl', new SendOwl({
              host: app.get('SENDOWL_HOST'),
              key: app.get('SENDOWL_KEY'),
              secret: app.get('SENDOWL_SECRET')
            }));

            app.set('shipwire', new Shipwire({
              host: app.get('SHIPWIRE_HOST'),
              username: app.get('SHIPWIRE_USER'),
              password: app.get('SHIPWIRE_PASS')
            }));

            _.each(resources, function (r) {
              r.init();
            });

            service.routes();

            // Catch all.
            app.use(function (req, res) {
              res.render('folder', {
                member: req.user,
                root: app.get('ROOT_URI')
              });
            });

            var server = http.createServer(app);

            var sio = socketio(server);
            sio.adapter(ioredis({
              pubClient: rp,
              subClient: rs
            }));
            sio.set('transports', ['websocket']);

            sio.use(psio.authorize({
              cookieParser: cookieParser,
              key: 'express.sid',
              name: 'express.sid',
              secret: app.get('sessionSecret'),
              store: app.get('sessionStore'),
              fail: function (data, message, error, accept) {
                accept(null, true);
              },
              success: function (data, accept) {
                accept(null, true);
              }
            }));

            sio.on('connection', function (webSock) {
              // Back-end socket for talking to other Island services
              var backSock = zmq.socket('sub');
              backSock.connect(app.get('SUB_SOCKET_PORT'));

              webSock._client = new Client(webSock, backSock);

              // Unsubscribe all on disconnect
              webSock.on('disconnect', function () {
                webSock._client.channelUnsubscribeAll();
                delete webSock._client;
              });
            });

            server.listen(app.get('PORT'));

            // if (cluster.worker.id === 1) {
              util.log('Web server listening on port ' + app.get('PORT'));
            // }
          }
        );
      // }
    }
  );
// }
