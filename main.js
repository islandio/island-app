#!/usr/bin/env node
/*
 * main.js: Entry point for the Island app.
 *
 */

var cluster = require('cluster');
var util = require('util');

if (cluster.isMaster) {

  // Count the machine's CPUs
  var cpus = require('os').cpus().length;

  // Create a worker for each CPU
  for (var i = 0; i < cpus; ++i)
    cluster.fork();

  // Listen for dying workers
  cluster.on('exit', function (worker) {

    // Replace the dead worker.
    util.log('Worker ' + worker.id + ' died');
    cluster.fork();
  });

} else {

  // Arguments
  var optimist = require('optimist');
  var argv = optimist
      .describe('help', 'Get help')
      .describe('port', 'Port to listen on')
        .default('port', 8000)
      .describe('index', 'Ensure indexes on MongoDB collections')
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
  var socketio = require('socket.io');
  var redis = require('redis');
  var RedisStore = require('connect-redis')(express);
  var request = require('request');
  var jade = require('jade');
  var stylus = require('stylus');
  var passport = require('passport');
  var psio = require('passport.socketio');
  var fs = require('fs');
  var path = require('path');
  var url = require('url');
  var Step = require('step');
  var _ = require('underscore');
  _.mixin(require('underscore.string'));
  var Connection = require('./lib/db').Connection;
  var Client = require('./lib/client').Client;
  var Search = require('node-lexsearch').Search;
  var resources = require('./lib/resources');
  var service = require('./lib/service');
  var Mailer = require('./lib/mailer');
  var PubSub = require('./lib/pubsub').PubSub;
      // Add instagram routes and subscriptions
  var Instagram = require('./lib/instagram');

  // Setup Environments
  var app = express();

  // Package info.
  app.set('package', JSON.parse(fs.readFileSync('package.json', 'utf8')));

  // App port is env var in production
  app.set('PORT', process.env.PORT || argv.port);

  // Add connection config to app.
  _.each(require('./config.json'), function (v, k) {
    app.set(k, process.env[k] || v);
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

        // Job scheduling.
        // app.set('SCHEDULE_JOBS', argv.jobs);
      }

      // Production only
      else {

        // App params
        app.set('ROOT_URI', [app.get('package').builds.cloudfront,
            app.get('package').version].join('/'));
        app.set('HOME_URI', [app.get('package').protocol,
            app.get('package').domain].join('://'));

        // Job scheduling.
        // app.set('SCHEDULE_JOBS', true);
      }

      // Redis connect
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST')));
      this.parallel()(null, redis.createClient(app.get('REDIS_PORT'),
          app.get('REDIS_HOST')));

    },
    function (err, rc, rp, rs) {
      if (err) return util.error(err);

      // Common utils init
      require('./lib/common').init(app.get('ROOT_URI'));



      // Mailer init
      app.set('mailer', new Mailer({
        user: app.get('GMAIL_USER'),
        password: app.get('GMAIL_PASSWORD'),
        from: app.get('GMAIL_FROM'),
        host: app.get('GMAIL_HOST'),
        ssl: app.get('GMAIL_SSL'),
      }, app.get('HOME_URI')));

      // PubSub init
      app.set('pubsub', new PubSub({mailer: app.get('mailer')}));

      // Express config
      app.set('views', __dirname + '/views');
      app.set('view engine', 'jade');
      app.set('sessionStore', new RedisStore({client: rc, maxAge: 2592000000}));
      app.set('sessionSecret', 'weareisland');
      app.set('sessionKey', 'express.sid');
      app.set('cookieParser', express.cookieParser(app.get('sessionKey')));
      app.use(express.favicon(__dirname + '/public/img/favicon.ico'));
      app.use(express.logger('dev'));
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
          res.render('500', {root: app.get('ROOT_URI')});
        });

        // Force HTTPS
        if (app.get('package').protocol === 'https')
          app.all('*', function (req, res, next) {
            if ((req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https')
              return next();
            res.redirect('https://' + req.headers.host + req.url);
          });
      }

      Instagram.init(app);

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

            app.set('cache', new Search({
              redisHost: app.get('REDIS_HOST'),
              redisPort: app.get('REDIS_PORT')
            }, this.parallel()));

            // Init resources.
            resources.init(app, this.parallel());
          },
          function (err) {
            if (err) return console.error(err);

            // Init service.
            service.routes(app);

            // Catch all.
            app.use(function (req, res) {
              res.render('base', {member: req.user, root: app.get('ROOT_URI')});
            });

            // HTTP server.
            var server = http.createServer(app);

            // Socket handling
            var sio = socketio.listen(server);
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

            // Socket connect
            sio.sockets.on('connection', function (socket) {
              socket.join('event');
              socket.join('post');
              socket.join('session');
              socket.join('tick');
              socket.join('comment');
              socket.join('hangten');
              socket.join('follow');
              socket.join('request');
              socket.join('accept');
              socket.join('watch');
              socket.join('map'); // tmp
              socket.join('media'); // tmp
              if (socket.handshake.user)
                socket.join('mem-' + socket.handshake.user._id);

              // FIXME: Use a key map instead of
              // attaching this directly to the socket.
              socket.client = new Client(socket, app.get('pubsub'));
            });

            // Set pubsub sio
            app.get('pubsub').setSocketIO(sio);

            // Start server
            server.listen(app.get('PORT'));
            util.log('Web and API server listening on port ' + app.get('PORT'));
          }
        );

      }
    }

  );

}
