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
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');

boots.start(function (client) {

  Step(
    function () {
      client.db.Events.list({action_type: {$in: ['post', 'session', 'tick']}}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (e) {
        var col = _.capitalize(e.action_type) + 's';
        var pub = e.public !== false;

        Step(
          function () {
            client.db[col]._update({_id: e.action_id}, {$set: {public: pub}}, this.parallel());
            client.db.Events._update({_id: e._id}, {$set: {public: pub}}, this.parallel());
          },
          _this
        );
      });
    },

    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );
});
