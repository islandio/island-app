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
var async = require('async');


boots.start(function (client) {

  var updateConsensus = function(grade, ascent, memberid, tickid, cb) {
    if (typeof tick === 'function') {
      cb = tick;
    }
    var consensus = ascent.consensus;
    // Remove old grade suggestion
    consensus = _.filter(consensus, function(c) {
      if (!c.author_id) return true;
      return (c.author_id.toString() !== memberid.toString());
    });
    consensus.push({
      grade: grade,
      author_id: memberid,
      tick_id: tickid
    });
    var newgrade = calculateGradeByConsensus(consensus);

    var update = {$set: {}};
    update.$set.consensus = consensus;
    if (newgrade !== ascent.grade) {
      update.$set.grade = newgrade;
    }
    client.db.Ascents.update({_id: ascent._id}, update, cb);
  };

  var calculateGradeByConsensus = function(consensus) {
    var byGrade = _.countBy(consensus, 'grade');
    var maxGrade = _.max(byGrade);
    var consensusGrades = [];
    _.each(byGrade, function(v, k) {
      if (maxGrade === v) {
        consensusGrades.push(Number(k));
      }
    });
    return (_.find(consensus, function(c) {
      return consensusGrades.indexOf(c.grade) !== -1;
    })).grade;
  }

  async.waterfall([
    function getTicks(cb) {
      client.db.Ticks.list({sent: true, grade: {$exists: true}}, cb);
    },
    function addToConsensus(ticks, cb) {
      console.log('Ok, got ticks');

      var queue = async.queue(function(task, cb) {
        var len = queue.length();
        if (len % 1000 === 0) {
          console.log(len + ' left');
        }
        client.db.Ascents.read({_id: task.ascent_id}, function(err, ascent) {
          updateConsensus(task.obj.grade, ascent, task.obj.author_id,
              task.obj.tick_id, cb);

        })
      }, 20);

      queue.drain = cb;

      _.each(ticks, function(t, idx) {
        queue.push({
          obj: {grade: t.grade, author_id: t.author_id, tick_id: t._id},
          ascent_id: t.ascent_id 
        });
      });

    }
  ], function finalCb(err) {
    boots.error(err);
    console.log('bye');
    process.exit(0);
  });

});
