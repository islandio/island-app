#!/usr/bin/env node
/*
 * boots.js: Wrapper for utility operations.
 *
 */

// Module Dependencies
var mongodb = require('mongodb');
var redis = require('redis');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Connection = require('./lib/db').Connection;
var resources = require('./lib/resources');
var config = require('./config.json');
_.each(config, function (v, k) {
  config[k] = process.env[k] || v;
});
var Search = require('node-lexsearch').Search;

var error = exports.error = function(err) {
  if (!err) return;
  util.error(err.stack);
  process.exit(1);
}

exports.start = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  var props = {};

  Step(
    function () {
      if (!opts.redis) return this();
      this(null, redis.createClient(config.REDIS_PORT, config.REDIS_HOST));
    },
    function (err, rc) {
      error(err);
      if (rc) {
        props.redisClient = rc;
      }

      Step(
        function () {
          new Connection(opts.muri || config.MONGO_URI, {}, this);
        },
        function (err, connection) {
          error(err);

          // Init resources.
          resources.init({connection: connection}, this.parallel());

          props.cache = new Search({
              redisHost: config.REDIS_HOST,
              redisPort: config.REDIS_PORT
          }, this.parallel());

        },
        function (err) {
          error(err);
          cb(props);
        }
      );
    }
  );
}
