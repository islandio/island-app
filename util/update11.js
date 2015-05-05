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

function replaceCountryCode(key, code) {
  var parts = key.split('/');
  parts[0] = code;
  return parts.join('/');
}

boots.start(function (client) {

  client.db.Countries.read({name: 'Romania'}, function (err, country) {
    boots.error(err);

    Step(
      function () {
        client.db.Crags.list({country_id: country._id}, this);
      },
      function (err, docs) {
        boots.error(err);

        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          var key = replaceCountryCode(d.key, country.key);
          client.db.Crags._update({_id: d._id}, {$set: {key: key}}, _this);
        });
      },
      
      function (err) {
        boots.error(err);
        client.db.Ascents.list({country_id: country._id}, this);
      },
      function (err, docs) {
        boots.error(err);

        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          var key = replaceCountryCode(d.key, country.key);
          client.db.Ascents._update({_id: d._id}, {$set: {key: key}}, _this);
        });
      },

      function (err) {
        boots.error(err);
        console.log('bye');
        process.exit(0);
      }
    );
  });
});
