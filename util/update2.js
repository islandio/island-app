#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
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
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');

boots.start(function (client) {
  Step(

    function () {
      var _this = this;
      client.db.Events.list({}, function (err, docs) {
        if (err) return _this(err);
        if (docs.length === 0) return _this();

        // Prepare events.
        var __this = _.after(docs.length, _this);
        _.each(docs, function (d) {

          // Inflate event action.
          client.db.inflate(d, {action: {collection: d.action_type, '*': 1}}, function (err) {
            if (err) return _this(err);
            if (d.action === 404) {
              client.db.Events.remove({_id: d._id}, __this);
            } else
              client.db.Events._update({_id: d._id},
                  {$set: {date: d.action.date || d.action.created}}, __this);
          });

        });
      });
    },
    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );
});
