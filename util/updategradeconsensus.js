#!/usr/bin/env node
/*
 *  update16.js: Add sent ticks to grad consensus
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
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var Step = require('Step');
var queue = require('queue-async');
var gradeConsensus = require('../lib/resources/ascent').calculateGradeByConsensus;

boots.start(function (client) {

  Step(
    function getAscents() {
      client.db.Ascents.list({}, this);
    },
    function fixGradeConsensus(err, ascents) {
      if (err) return this(err);
      var q = queue(25);
      var fcn = _.bind(client.db.Ascents.update, client.db.Ascents);
      _.each(ascents, function(a) {
        q.defer(fcn, {_id: a._id},
            {$set: {grade: gradeConsensus(a.consensus)}})
      });
      q.awaitAll(this)
    },
    function done(err) {
      if (err) console.log(err, err.stack);
      process.exit();
    }
  );

});
