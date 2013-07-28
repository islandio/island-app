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
var Connection = require('../lib/db.js').Connection;
var resources = require('../lib/resources');
var c = require('../config').get(process.env.NODE_ENV);

var error = exports.error = function(err) {
  if (!err) return;
  util.error(err.stack);
  process.exit(1);
}

exports.start = function (cb) {

  Step(
    function () {

      // Redis connect
      if (c.REDIS_PASS) {
        var rc = redis.createClient(c.REDIS_PORT, c.REDIS_HOST);
        rc.auth(c.REDIS_PASS, _.bind(function (err) {
          this(err, rc);
        }, this));
      } else
        this(null, redis.createClient(c.REDIS_PORT, c.REDIS_HOST));

    },
    function (err, rc) {
      error(err);

      Step(
        function () {
          new Connection(c.MONGO_URI, {}, this);
        },
        function (err, connection) {
          error(err);

          // Init resources.
          resources.init({connection: connection}, this);
        },
        function (err) {
          error(err);
          cb(rc);
        }
      );
    }

  );
}
