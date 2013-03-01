#!/usr/bin/env node

var request = require('request');
var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

// Errors wrapper.
function errCheck(err, op) {
  if (err) {
    error('Error: ' + (op || '') + ':\n' + err.stack);
    process.exit(1);
  };
}

// Matches crag anchor tags:
var crag_rx = new RegExp(/<a.*?CragId=([0-9]+).*?TITLE='(.*?)'.*?Country: (.*?)<br>City: (.*?)<br>.*?<\/a>/gi);

// Matches google maps latlong point for a crag:
var geo_rx = new RegExp(/var point_(.*?) = new GLatLng\((.*?), (.*?)\);/gi);

// Open list for crags:
var crags = [
  /*
  {
    id: Number,
    name: String,
    country: String,
    city: String,
    lat: Number,
    lon: Number
  }
  */
];

// Save a session cookie ref for tick list requests.
var cookie;

Step(
  // Get the global 8a.nu crags page.
  function () {
    log('Harvesting crags from 8a.nu...');
    request.get({
      uri: 'http://www.8a.nu/crags/List.aspx',
      qs: {CountryCode: 'GLOBAL'},
    }, this);
  },
  // Parse the HTML response into JSON crags.
  function (err, res, body) {
    log('Parsing response...');
    errCheck(err, res);
    // cookie = res.headers['set-cookie'];
    while ((match = crag_rx.exec(body)) !== null)
      crags.push({
        id: Number(match[1].trim()),
        name: match[2].trim(),
        country: match[3].trim(),
        city: match[4].trim(),
      });
    this();
  },
  // Get the global 8a.nu crag maps page.
  function () {
    log('Harvesting crag locations from 8a.nu...');
    request.get({
      uri: 'http://www.8a.nu/crags/MapCrags.aspx',
      qs: {CountryCode: 'GLOBAL'},
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.57 Safari/537.17'
      }
    }, this);
  },
  // Remove latlons from HTML response.
  function (err, res, body) {
    errCheck(err, res);
    log('Parsing response...');
    while ((match = geo_rx.exec(body)) !== null) {
      var crag = _.find(crags, function (c) {
        return c.id === Number(match[1])
      });
      if (crag)
        _.extend(crag, {lat: Number(match[2]), lon: Number(match[3])});
    }
    this();
  },

  // // Get ascents from each crag. 
  // function () {
  //   request.get({
  //     uri: 'http://www.8a.nu/scorecard/Ticklist.aspx?CragName=Kalymnos',
  //     // qs: {CountryCode: 'GLOBAL'},
  //     headers: {
  //       'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.57 Safari/537.17',
  //       'Cookie': 'ASP.NET_SessionId=j1mzks55gbiakv453eizdr55; bsau=13619875813314199202; id=; 8aLogin=sanderpick@gmail.com; 8aLoginId=b5e6a670fa4b295e96ebeb44e9e42895; NetSessionId=j1mzks55gbiakv453eizdr55; bsas=13620184140519359645; __unam=613e139-13d1cc9309d-6f10eabe-15; LatestSearch=Kalymnos,GRC,0@Red+River+Gorge,USA,0@New+River+Gorge,USA,0@; __utma=74559963.1199485526.1361987578.1362016643.1362018867.5; __utmb=74559963.3.10.1362018867; __utmc=74559963; __utmz=74559963.1361988217.2.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided)',
  //     },
  //   }, this);
  // },
  // // Remove latlons from HTML response.
  // function (err, res, body) {
  //   errCheck(err, res);
  //   log('Parsing response...');
  //   log(body)
  //   // while ((match = geo_rx.exec(body)) !== null) {
  //   //   var crag = _.find(crags, function (c) {
  //   //     return c.id === Number(match[1])
  //   //   });
  //   //   if (crag)
  //   //     _.extend(crag, {lat: Number(match[2]), lon: Number(match[3])});
  //   // }
  //   this();
  // },

  // Done.
  function (err) {
    errCheck(err);
    log('Crags:', crags);
    log('\nMy work here is done.\n');
    process.exit(0);
  }
);
