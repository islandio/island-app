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
var Connection = require('./lib/db').Connection;
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
      app.set('HOME_URI', [app.get('package').protocol,
          app.get('package').domain].join('://'));

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

    // Common utils init.
    require('./lib/common').init(app.get('ROOT_URI'));

    // Mailer init
    app.set('mailer', new Mailer(app.get('gmail'), app.get('HOME_URI')));

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
          new Connection(app.get('MONGO_URI'),
              {ensureIndexes: argv.index}, this);
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
