#!/usr/bin/env node
/*
 *  update16.js: Ascent grades from array to
 *  {
 *    grade: <number>
 *    consensus: [
 *      { grade: <number>, author_id: <ObjectID or null> }
 *      { grade: <number>, author_id: <ObjectID or null> }
 *    ]
 *  }
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
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var async = require('async');
var GradeConverter = new require('../public/js/GradeConverter').GradeConverter;

var gradeConverter = {
  'b': new GradeConverter('boulders').from('font').to('indexes'),
  'r': new GradeConverter('routes').from('french').to('indexes')
};

boots.start(function (client) {

  console.log('Getting all ascents');

  async.waterfall([
    function getAscents(cb) {
      client.db.Ascents.list({grades: {$exists: true}}, cb);
    },
    function fixAscents(ascents, cb) {
      console.log('Ok, got ascents');

      var queue = async.queue(function(task, cb) {
        var len = queue.length();
        if (len % 1000 === 0) {
          console.log(len + ' left');
        }
        client.db.Ascents.update({_id: task.id}, {
            $set: {grade: task.obj.grade, consensus: task.obj.consensus},
            $unset: {grades: ''}}, cb);
      }, 20);

      queue.drain = cb;

      _.each(ascents, function(a, idx) {
        if (a.grades) {
          try {
            if (!_.isNumber(a.grades[0])) {
              a.grades = gradeConverter[a.type].convert(a.grades);
            }
            var obj = {};
            obj.grade = a.grades[0];
            obj.consensus = [];
            _.each(a.grades, function(a) {
              obj.consensus.push({grade: a});
            });
            queue.push({
              obj: obj,
              id: a._id
            });
          } catch (err) {
            console.log('ERROR', err, a, idx);
          }
        }
      });
    }
  ], function finalCb(err) {
    boots.error(err);
    console.log('bye');
    process.exit(0);
  });

});
