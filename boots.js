#!/usr/bin/env node
/*
 * boots.js: Wrapper for utility operations.
 *
 */

// Module Dependencies
var redis = require('redis');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('mongish');
var Search = require('island-search').Search;
var Events = require('island-events').Events;
var collections = require('island-collections').collections;

var app = require('./app').init();

_.each(require('./config.json'), function (v, k) {
  app.set(k, process.env[k] || v);
});

var error = exports.error = function (err) {
  if (!err) return;
  console.error(err.stack || err);
  process.exit(1);
};

exports.start = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  Step(
    function () {
      new db.Connection(app.get('MONGO_URI'), {ensureIndexes: opts.index},
          this.parallel());

      if (app.get('REDIS_PORT') && app.get('REDIS_HOST_CACHE')) {
        app.set('search', new Search({
          redisHost: app.get('REDIS_HOST_CACHE'),
          redisPort: app.get('REDIS_PORT')
        }, this.parallel()));
      }
    },
    function (err, connection) {
      if (_.size(collections) === 0) {
        return this();
      }
      _.each(collections, _.bind(function (c, name) {
        connection.add(name, c, this.parallel());
      }, this));
    },
    function (err) {
      error(err);

      app.set('db', db);
      app.set('events', new Events({db: db}));

      cb(app);
    }
  );
};
