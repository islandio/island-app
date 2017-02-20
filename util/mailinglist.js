#!/usr/bin/env node

var _ = require('underscore');
var Step = require('step');
var boots = require('../boots');
var async = require('async');

boots.start(function (client) {
  var db = client.get('db');

  Step(
    function () {
      db.Members.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      console.log(['name', 'email'].join(','));

      docs.forEach(function(mem) {
        if (mem.primaryEmail) {
          console.log([(mem.displayName || mem.username).trim(),
              mem.primaryEmail].join(','));
        }
      });

      this();
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );

});
