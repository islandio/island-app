#!/usr/bin/env node
/*
 * ship.js: Ship app to production.
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
var boots = require('./boots');
var db = require('../lib/db.js');

boots.start(function (client) {

  var search = reds.createSearch('ascents');
  search.client = client;

  
  
});
