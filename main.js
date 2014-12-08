#!/usr/bin/env node
/*
 * main.js: Entry point for the Island app.
 *
 */

var _package_ = require('./package.json');
var cluster = require('cluster');
var util = require('util');
var cpus = require('os').cpus().length;
var ngrok = require('ngrok');

if (cluster.isMaster) {

  var ngrokUrl = null;
  var createWorkers = function() {

    // Create a worker for each CPU.
    for (var i = 0; i < cpus; ++i) {
      cluster.fork({NGROKURL: ngrokUrl});
    }

    // Listen for dying workers
    cluster.on('exit', function (worker) {

      // Replace the dead worker.
      util.log('Worker ' + worker.id + ' died');
      cluster.fork({NGROKURL: ngrokUrl});
    });
  }

  // Setup an outside tunnel to our localhost in development.
  // We will pass this to the workers.
  if (process.env.NODE_ENV !== 'production' && _package_.outsideTunnel) {
    ngrok.connect(_package_.port, function (err, url) {
      util.log('Setting up tunnel from this machine to ' + url);
      ngrokUrl = url;
      createWorkers();
    });
  } else {
    createWorkers();
  }
} else {

  // Arguments
  var optimist = require('optimist');
  var argv = optimist
      .describe('help', 'Get help')
      .describe('index', 'Ensure indexes on MongoDB collections')
        .boolean('index')
      .argv;

  if (argv._.length || argv.help) {
    optimist.showHelp();
    process.exit(1);
  }

  // Module Dependencies
  var http = require('http');
  var https = require('https');
  var connect = require('connect');
  var express = require('express');
  var slashes = require('connect-slashes');
  var zmq = require('zmq');
  var socketio = require('socket.io');
  var redis = require('redis');
  var RedisStore = require('connect-redis')(express);
  var jade = require('jade');
  var stylus = require('stylus');
  var passport = require('passport');
  var psio = require('passport.socketio');
  var fs = require('fs');
  var path = require('path');
  var url = require('url');
  var Step = require('step');
  var iutil = require('island-util');
  var _ = require('underscore');
  _.mixin(require('underscore.string'));
  var db = require('mongish');
  var Search = require('island-search').Search;
  var collections = require('island-collections').collections;
  var Events = require('island-events').Events;
  var Emailer = require('island-emailer').Emailer;
  var resources = require('./lib/resources.js').resources;
  var Client = require('./lib/client').Client;
  var service = require('./lib/service');

  // Setup Environments
  var app = require('./app').init();

  // Package info.
  app.set('package', _package_);

  // App port is env var in production.
  app.set('PORT', process.env.PORT || app.get('package').port);
  app.set('SECURE_PORT', app.get('package').securePort);

  // Add connection config to app.
  _.each(require('./config.json'), function (v, k) {
    app.set(k, process.env[k] || v);
  });

  /*
   * Error wrap JSON request.
   */
  function errorHandler(err, req, res, data, estr) {
    if (typeof data === 'string') {
      estr = data;
      data = null;
    }
    var fn = req.xhr ? res.send: res.render;
    if (err || (!data && estr)) {
      var profile = {
        member: req.user,
        content: {page: null},
        root: app.get('ROOT_URI'),
        transloadit: service.transloadit(req)
      };
      if (err) {
        util.error(err);
        profile.error = {stack: err.stack};
        fn.call(res, 500, iutil.client(profile));
      } else {
        profile.error = {message: estr + ' not found'};
        fn.call(res, 404, iutil.client(profile));
      }
      return true;
    } else return false;
  }

  Step(
    function () {

      // Development only
      if (process.env.NODE_ENV !== 'production') {

        // App params
        app.set('ROOT_URI', '');
        app.set('HOME_URI', 'http://localhost:' + app.get('PORT'));
        app.set('TUNNEL_URI', process.env['NGROKURL']);
      }

      // Production only
      else {

        // App params
        app.set('ROOT_URI', [app.get('package').builds.cloudfront,
            app.get('package').version].join('/'));
        app.set('HOME_URI', [app.get('package').protocol.name,
            app.get('package').domain].join('://'));
      }

      // Redis connect
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST_SESSION')));

    },
    function (err, rc, rp, rs) {
      if (err) {
        console.error(err);
        process.exit(1);
        return;
      }

      // App config.
      app.set('db', db);
      app.set('emailer', new Emailer({
        db: db,
        user: app.get('GMAIL_USER'),
        password: app.get('GMAIL_PASSWORD'),
        from: app.get('GMAIL_FROM'),
        host: app.get('GMAIL_HOST'),
        ssl: app.get('GMAIL_SSL'),
        baseURI: app.get('HOME_URI')
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

      // Express config
      app.set('views', __dirname + '/views');
      app.set('view engine', 'jade');
      app.set('sessionStore', new RedisStore({client: rc, maxAge: 2592000000}));
      app.set('sessionSecret', 'weareisland');
      app.set('sessionKey', 'express.sid');
      app.set('cookieParser', express.cookieParser(app.get('sessionKey')));
      app.use(express.logger('dev'));

      // Get the raw body
      // http://stackoverflow.com/questions/18710225/node-js-get-raw-request-body-using-express
      app.use(function (req, res, next) {
        req.rawBody = '';
        req.setEncoding('utf8');
        req.on('data', function (chunk) { 
          req.rawBody += chunk;
        });
        next();
      });
      app.use(express.bodyParser());
      app.use(app.get('cookieParser'));
      app.use(express.session({
        store: app.get('sessionStore'),
        secret: app.get('sessionSecret'),
        key: app.get('sessionKey')
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
      }

      // Production only
      else {
        app.use(express.favicon(app.get('ROOT_URI') + '/img/favicon.ico'));
        app.use(express.static(__dirname + '/public', {maxAge: 31557600000}));
        app.use(slashes(false));
        app.use(app.router);
        app.use(function (err, req, res, next) {
          if (!err) return next();
          console.error('Returning code 500', err);
          console.error(err.stack);
          res.render('500', {root: app.get('ROOT_URI')});
        });
      }

      app.all('*', function (req, res, next) {

        // Check protocol.
        if (process.env.NODE_ENV === 'production'
            && app.get('package').protocol.name === 'https') {
          if (req.secure || _.find(app.get('package').protocol.allow,
              function (allow) {
            return req.url === allow.url && req.method === allow.method;
          })) {
            return _next();
          }
          res.redirect(301, 'https://' + req.headers.host + req.url);
        } else {
          _next();
        }

        // Ensure Safari does not cache the response.
        function _next() {
          var agent;
          agent = req.headers['user-agent'];
          if (agent && agent.indexOf('Safari') > -1
              && agent.indexOf('Chrome') === -1
              && agent.indexOf('OPR') === -1) {
            res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.header('Pragma', 'no-cache');
            res.header('Expires', 0);
          }
          next();
        }
      });

      if (!module.parent) {

        Step(
          function () {

            // Open DB connection.
            new db.Connection(app.get('MONGO_URI'), {ensureIndexes: 
                argv.index && cluster.worker.id === 1},
                this.parallel());

            // Init search cache.
            app.set('cache', new Search({
              redisHost: app.get('REDIS_HOST_CACHE'),
              redisPort: app.get('REDIS_PORT')
            }, this.parallel()));
          },
          function (err, connection) {
            if (err) return this(err);

            // Init collections.
            if (_.size(collections) === 0) {
              return this();
            }
            _.each(collections, _.bind(function (c, name) {
              connection.add(name, c, this.parallel());
            }, this));
          },
          function (err) {
            if (err) {
              console.error(err);
              process.exit(1);
              return;
            }

            // Init resources.
            _.each(resources, function (r, name) {
              r.init();
            });

            // Init service.
            service.routes(app);

            // Catch all.
            app.use(function (req, res) {
              res.render('folder', {
                member: req.user,
                root: app.get('ROOT_URI')
              });
            });

            // HTTP(S) server.
            var server, _server;
            if (process.env.NODE_ENV !== 'production') {
              server = http.createServer(app);
            } else {
              server = https.createServer({
                ca: fs.readFileSync('./ssl/ca-chain.crt'),
                key: fs.readFileSync('./ssl/www_island_io.key'),
                cert: fs.readFileSync('./ssl/www_island_io.crt')
              }, app);
              _server = http.createServer(app);
            }

            // Socket handling
            var sio = socketio.listen(server, {log: false,
                secure: process.env.NODE_ENV === 'production'});
            sio.set('store', new socketio.RedisStore({
              redis: redis,
              redisPub: rp,
              redisSub: rs,
              redisClient: rc
            }));

            // Development only.
            if (process.env.NODE_ENV !== 'production') {
              sio.set('log level', 2);
            } else {
              sio.enable('browser client minification');
              sio.enable('browser client etag');
              sio.enable('browser client gzip');
              sio.set('log level', 1);
              sio.set('transports', [
                'websocket',
                'flashsocket',
                'htmlfile',
                'xhr-polling',
                'jsonp-polling'
              ]);
            }

            // Socket auth
            sio.set('authorization', psio.authorize({
              cookieParser: express.cookieParser,
              key: app.get('sessionKey'),
              secret: app.get('sessionSecret'),
              store: app.get('sessionStore'),
              fail: function(data, accept) { accept(null, true); },
              success: function(data, accept) { accept(null, true); }
            }));

            // Websocket connect
            sio.sockets.on('connection', function (webSock) {

              // Back-end socket for talking to other Island services
              var backSock = zmq.socket('sub');
              backSock.connect(app.get('SUB_SOCKET_PORT'));

              // Create new client.
              webSock.client = new Client(webSock, backSock);
            });

            // Start server
            if (process.env.NODE_ENV !== 'production') {
              server.listen(app.get('PORT'));
            } else {
              server.listen(app.get('SECURE_PORT'));
              _server.listen(app.get('PORT'));
            }
            if (cluster.worker.id === 1) {
              util.log('Web server listening on port '
                  + (process.env.NODE_ENV !== 'production' ?
                  app.get('PORT'): app.get('SECURE_PORT'))
                  + ' with ' + cpus + ' worker(s)');
            }
          }
        );
      }
    }
  );
}
