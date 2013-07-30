#!/usr/bin/env node
/*
 * index_crags.js: Index all Island crags by name.
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
var reds = require('reds');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db.js');

boots.start(function (client) {

  var search = reds.createSearch('crags');
  search.client = client;

  db.Crags.list({}, function (err, docs) {
    boots.error(err);

    Step(
      function () {
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          if (d.name && d.name !== '')
            if (d.name.match(/\w+/g))
              search.index(d.name, d._id.toString());
          _this();
        });
      },
      function (err) {
        boots.error(err);
        process.exit(0);
      }
    );

  });
  
});
