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
      boots.error(err);

      // Get all ascents.
      db.Ascents.list({}, this.parallel());
      cache.del('ascents-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d, idx) {
        // Add new.
        ascentsIndexed += cache.index('ascents', d, ['name'],
            _this);
      });
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed ascents');
      util.log('Ascents entries: ' + ascentsIndexed);
      process.exit(0);
    }
  );

});
