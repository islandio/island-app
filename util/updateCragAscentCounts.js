#!/usr/bin/env node

var _ = require('underscore');
var boots = require('@islandio/boots');
var async = require('async');

boots.start(function (client) {
  var db = client.get('db');

  var Crags = require('../lib/resources/crag');

  async.waterfall([
    function (cb) {
      db.Crags.list({}, cb);
    },
    function (crags, cb) {

      var queue = async.queue(function (crag, cb) {
        var len = queue.length();
        if (len % 100 === 0) {
          console.log(len + ' left');
        }
        Crags.refreshAscentCounts(crag._id, cb);
      }, 1);

      queue.drain = cb;

      _.each(crags, function (c) {
        queue.push(c);
      });

    }
  ], function (err) {
    boots.error(err);
    console.log('bye');
    process.exit(0);
  });

});
