#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('from', 'Member username to move posts from')
      .demand('from')
    .describe('to', 'Member username to move posts to')
      .demand('to')
    .describe('type', 'Type of posts to move')
      .demand('type')
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

  var from, to, cnt;

  Step(
    function () {
      client.db.Members.read({username: argv.from}, this.parallel());
      client.db.Members.read({username: argv.to}, this.parallel());
    },
    function (err, _from, _to) {
      boots.error(err);
      if (!_from) {
        boots.error('Member username to move posts from not found');
      }
      if (!_to) {
        boots.error('Member username to move posts to not found');
      }
      from = _from;
      to = _to;
      client.db.Posts.list({author_id: from._id, type: argv.type}, this);
    },
    function (err, docs) {
      boots.error(err);
      cnt = docs.length;

      if (docs.length === 0) {
        return this();
      }
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        Step(
          function () {
            var key = [to.username, _.strRight(d.key, '/')].join('/');
            client.db.Posts._update({_id: d._id}, {$set: {author_id: to._id, key: key}}, this.parallel());
            client.db.Events._update({action_id: d._id}, {$set: {
              actor_id: to._id,
              'data.action': {
                i: to._id.toString(),
                a: to.displayName,
                g: iutil.hash(to.primaryEmail || 'foo@bar.baz'),
                s: key
              }
            }}, this.parallel());
          },
          _this
        );
      });
    },
    function (err) {
      boots.error(err);
      console.log('moved ' + cnt + ' ' + argv.type + ' post(s)');
      console.log('bye');
      process.exit(0);
    }
  );
});
