#!/usr/bin/env node
/*
 *  Re-calculate grade consensus.
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
var _s = require('underscore.string');
var boots = require('@islandio/boots');
var async = require('async');


boots.start(function (client) {

  var updateConsensus = function(ascent, ticks, cb) {
    var consensus = [];
    if (ascent.grade) {
      consensus.push({grade: ascent.grade});
    }
    _.each(ticks, function(t) {
      if (t.grade) {
        consensus.push({
          grade: t.grade,
          author_id: t.author_id,
          tick_id: t._id
        });
      }
    });
    var newgrade = calculateGradeByConsensus(consensus);

    var update = {$set: {}};
    update.$set.consensus = consensus;
    if (newgrade && newgrade !== ascent.grade) {
      update.$set.grade = newgrade;
    }
    client.db.Ascents.update({_id: ascent._id}, update, cb);
  };

  var calculateGradeByConsensus = function(consensus) {
    // If sent, don't include suggestions (ie, no tick_id)
    if (_.some(consensus, function(c) { return !!c.tick_id; })) {
      consensus = _.filter(consensus, function(c) { return !!c.tick_id; });
    }

    var byGrade = _.countBy(consensus, 'grade');

    // If grades exist other than -1 (Project), ignore Project grades
    if (byGrade['-1'] && _.keys(byGrade).length > 1) {
      delete byGrade['-1'];
    }

    var maxGrade = _.max(byGrade);
    var consensusGrades = [];
    _.each(byGrade, function(v, k) {
      if (maxGrade === v) {
        consensusGrades.push(Number(k));
      }
    });
    f = _.find(consensus, function(c) {
      return consensusGrades.indexOf(c.grade) !== -1;
    });
    return _.isUndefined(f) ? null : f.grade;
  };

  async.waterfall([
    function getTicks(cb) {
      client.db.Ascents.list({}, cb);
    },
    function addToConsensus(ascents, cb) {
      console.log('Ok, got ascents');

      var queue = async.queue(function(ascent, cb) {
        var len = queue.length();
        if (len % 1000 === 0) {
          console.log(len + ' left');
        }
        client.db.Ticks.list({ascent_id: ascent._id, sent: true}, function(err, ticks) {
          updateConsensus(ascent, ticks, cb);
        });
      }, 20);

      queue.drain = cb;

      _.each(ascents, function(a) {
        queue.push(a);
      });

    }
  ], function finalCb(err) {
    boots.error(err);
    console.log('bye');
    process.exit(0);
  });

});
