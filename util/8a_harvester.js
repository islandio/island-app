#!/usr/bin/env node

var request = require('request');
var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

var CartoDB = require('cartodb');
var client = new CartoDB({
  user: 'island',
  api_key: '883965c96f62fd219721f59f2e7c20f08db0123b'
});

// Errors wrapper.
function errCheck(err, op) {
  if (err) {
    error('Error: ' + (op || '') + ':\n' + err.stack);
    process.exit(1);
  };
}

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.57 Safari/537.17'
};

// Matches crag anchor tags:
var country_rx = new RegExp(/CountryCode=([A-Z]{3}?)/gi);

// Matches crag anchor tags:
var crag_rx = new RegExp(/<a.*?CragId=([0-9]+).*?TITLE='(.*?)'.*?Country: (.*?)<br>City: (.*?)<br>.*?<\/a>/gi);

// Matches google maps latlong point for a crag:
var geo_rx = new RegExp(/var point_(.*?) = new GLatLng\((.*?), (.*?)\);/gi);

// Matches ascent tr tags:
var ascent_rx = new RegExp(/<tr.*?class='Height20'.*?<td><b>(.*?)<\/b><\/td><td>(.*?)<\/td><td>.*?<\/td><td>.*?<\/td><td><a.*?<\/a> \/ (.*?)<\/td>/gi);

// Open list for countries:
var countries = [
  // 'CODE'
];

// Open object for crag points:
var points = {
  /*
  'ID': {
    lat: Number,
    lon: Number,
  }
  */
};

// Open list for crags:
var crags = [
  /*
  {
    id: Number,
    name: String,
    country: String,
    city: String,
    lat: Number,
    lon: Number,
  }
  */
];

// Open list for ascents:
var ascents = [
  /*
  {
    grade: String,
    name: String,
    sector: String,
    type: String,
    crag_name: String,
    crag_id: Number,
  }
  */
];

Step(

  // Get the global 8a.nu crags page.
  function () {
    log('Working...');
    request.get({
      uri: 'http://www.8a.nu/crags/List.aspx',
      qs: {CountryCode: 'GLOBAL'},
    }, this.parallel());
    request.get({
      uri: 'http://www.8a.nu/crags/MapCrags.aspx',
      qs: {CountryCode: 'GLOBAL'},
      headers: headers,
    }, this.parallel());
  },

  // Parse out country codes from the HTML response.
  function (err, list, map) {
    errCheck(err);
    // List:
    while ((match = country_rx.exec(list.body)) !== null)
      countries.push(match[1]);
    countries = _.union(countries);
    if (countries.length === 0)
      errCheck('No countries found.');
    countries = _.reject(countries, function (c) { return c === 'GLO'; });
    log('Found ' + countries.length + ' countries.');
    // Map:
    while ((match = geo_rx.exec(map.body)) !== null)
      points[Number(match[1])] = {lat: Number(match[2]), lon: Number(match[3])};
    log('Found ' + _.size(points) + ' crag locations.');
    this();
  },

  // Get crags from each country.
  function () {
    var next = _.after(countries.length, this);
    _.each(countries, function (c) {
      request.get({
        uri: 'http://www.8a.nu/crags/List.aspx',
        qs: {CountryCode: c},
      }, function (err, res, body) {
        errCheck(err, res);
        var cs = [];
        while ((match = crag_rx.exec(body)) !== null)
          cs.push({
            id: Number(match[1].trim()),
            name: match[2].trim(),
            country: match[3].trim(),
            city: match[4].trim(),
          });
        log('Found ' + cs.length + ' crags in ' + c + '.');
        crags.push(cs);
        next();
      });
    });
  },

  // Join country crags and crag points.
  function () {
    crags = _.reduceRight(crags, function (a, b) {
      return a.concat(b); }, []);
    log('Found ' + crags.length + ' on Earth.');
    _.each(crags, function (c) {
      if (points[c.id] !== undefined)
        _.extend(c, points[c.id]);
    });
    this();
  },

  // Get the global 8a.nu crag maps page.
  function () {
    log('Working...');
    request.get({
      uri: 'http://www.8a.nu/crags/MapCrags.aspx',
      qs: {CountryCode: 'GLOBAL'},
      headers: headers,
    }, this);
  },

  // Get the ascents from each crag.
  function () {
    crags = _.first(crags, 2);
    var types = [0, 1];
    var next = _.after(crags.length * types.length, this);
    _.each(crags, function (c) {
      _.each(types, function (t) {
        request.get({
          uri: 'http://www.8a.nu/scorecard/Search.aspx',
          qs: {
            Mode: '',
            AscentType: t,
            CragName: c.name,
          },
          headers: headers,
        }, function (err, res, body) {
          errCheck(err, res);
          var as = [];
          while ((match = ascent_rx.exec(body)) !== null) {
            var a = {
              grade: match[1].trim(),
              name: match[2].trim(),
              sector: match[3].trim(),
              type: t ? 'boulder' : 'route',
              crag_name: c.name,
              crag_id: c.id,
            };
            as.push(a);
          }
          log('Found ' + as.length + (t ? ' boulders' : ' routes')
              + ' in ' + c.name + '.');
          ascents.push(as);
          next();
        });
      });
    });
  },

  // Join crag ascents.
  function () {
    ascents = _.reduceRight(ascents, function (a, b) {
      return a.concat(b); }, []);
    log('Found ' + ascents.length + ' on Earth.');
    this();
  },

  // Done.
  function (err) {
    errCheck(err);
    log('\nMy work here is done.\n');
    process.exit(0);
  }
);
