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
var fs = require('fs');
var util = require('util');
var async = require('async');
var request = require('request');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var Converter = require('csvtojson').core.Converter;

boots.start(function (client) {

  var fileStream = fs.createReadStream('./ISOCodes_en_2012.csv');
  var csvConverter = new Converter({constructResult: true});
  csvConverter.on('end_parsed', function (codes) {
    client.db.Countries.list({}, function (err, docs) {
      boots.error(err);

      var q = async.queue(function (doc, cb) {
        var map = _.find(codes, function (c) {
          return c.iso3.toLowerCase() === doc.key;
        });
        var code = map.iso2;
        var infoUrl = 'http://api.geonames.org/countryInfoJSON?formatted=true' +
            '&username=islandio&country=' + code;
        request.get({url: infoUrl, json: true}, function (err, r, data) {
          boots.error(err);
          if (!data || !data.geonames || !data.geonames[0]) {
            console.log('No data found');
            return cb();
          }
          var meta = data.geonames[0];
          client.db.Countries._update({_id: doc._id}, {$set: {meta: meta}}, cb);
        });
      }, 1);

      q.drain = function () {
        console.log('bye');
        process.exit(0);
      };

      q.push(docs, function (err) {
        console.log('finished processing item');
      });

    });
  });
  fileStream.pipe(csvConverter);

});
