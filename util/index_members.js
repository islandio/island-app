#!/usr/bin/env node
/*
 * index_members.js: Index all Island members by username and displayName.
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
var boots = require('./boots');
var db = require('../lib/db.js');
var com = require('../lib/common.js');

boots.start(function (client) {

  var search = reds.createSearch('members');
  search.client = client;

  db.Members.list({}, function (err, docs) {
    boots.error(err);

    Step(
      function () {
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {
          if (d.displayName && d.displayName !== ''
              && d.displayName.match(/\w+/g))
            if (d.displayName.match(/\w+/g))
              search.index(d.displayName, d._id.toString());
          if (d.username && d.username !== '') {
            if (d.username.match(/\w+/g))
              search.index(d.username, d._id.toString());
            _this();
          } else
            db.Members._update({_id: d._id}, {$set: {username: com.key()}},
                {safe: true}, _this);
        });
      },
      function (err) {
        boots.error(err);
        process.exit(0);
      }
    );

  });
  
});
