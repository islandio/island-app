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
var c = require('./config').get(process.env.NODE_ENV);

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
      this(null, redis.createClient(c.REDIS_PORT, c.REDIS_HOST));
    },
    function (err, rc) {
      error(err);
      if (rc) {
        props.redisClient = rc;
      }

      Step(
        function () {
          new Connection(c.MONGO_URI, {ensureIndexes: opts.index}, this);
        },
        function (err, connection) {
          error(err);

          // Init resources.
          resources.init({connection: connection}, this);
        },
        function (err) {
          error(err);
          cb(props);
        }
      );
    }
  );
}
