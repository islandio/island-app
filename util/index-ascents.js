#!/usr/bin/env node
/*
 * index.js: Index all ascents, members, crags, and posts for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');

var ascentsIndexed = 0;

boots.start({redis: true, muri: argv.muri}, function (client) {

  var cache = client.cache;

  Step(
    function () {

      // Get all ascents.
      db.Ascents.list({}, this.parallel());
      cache.del('ascents-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      var next = this;

      if (docs.length === 0) return this();
      var iter = 0;

      var run100 = function () {
        for (var i = iter;i < (iter + 100) && i < docs.length; i++) {
          ascentsIndexed += cache.index('ascents', docs[i], ['name'], function(err) { step(err, i) });
        }
      };

      var step = function(err, i) {
        if (err) { boots.error(err); process.exit(0) }
        else if (i === docs.length) { next(); }
        else if (i === iter + 100) { 
          if (i % 10000 === 0) console.log(iter/docs.length * 100 + '%');
          iter = i;
          run100();
        }
        else {}
      };

      run100();

    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed ascents');
      util.log('Ascents entries: ' + ascentsIndexed);
      process.exit(0);
    }
  );

});
