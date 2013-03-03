#!/usr/bin/env node

var request = require('request');
var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var clc = require('cli-color');

// Errors wrapper.
function errCheck(err, op) {
  if (err) {
    error('Error: ' + (op || '') + ':\n' + err.stack);
    process.exit(1);
  };
}

// Format title strings.
function format(str) {
  return _.capitalize(str.trim());
}

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.57 Safari/537.17'
};

// CartoDB creds:
var cartodb = {
  user: 'island',
  api_key: '883965c96f62fd219721f59f2e7c20f08db0123b'
};

// Matches crag anchor tags:
var country_rx = new RegExp(/CountryCode=([A-Z]{3})">([^<]+)</gi);

// Matches google maps latlong point for a crag:
var geo_rx = new RegExp(/var point_([0-9]+) = new GLatLng\(([-0-9\.]+), ([-0-9\.]+)\);/gi);

// Matches crag anchor tags:
var crag_rx = new RegExp(/<a.+?CragId=([0-9]+).+?TITLE='([^']+)'.+?Country: ([^<]+)<br>City: ([^<]+)?<br>/gi);

// Matches ascent tr tags:
var ascent_row_rx = new RegExp(/<tr class='Height20'.+?<\/tr>/gi);

// Matches ascent details:
var ascent_rx = /^<tr class='Height20'.+?<td><b>([^<]+)<\/b><\/td><td>([^<]+)<\/td>.+">(.+)<\/a>( \/ (.+))?<\/td><\/tr>$/;

// Open list for countries:
var countries = {
  /*
  'NAME': String ('CODE')
  */
};

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
    country_code: String,
    city: String,
    boulders: Number,
    routes: Number,
    boulder_grade: Number,
    route_grade: Number,
    lat: Number,
    lon: Number,
  }
  */
];

// Counter for ascents:
var ascents = 0;
  /*
  {
    grade: Number,
    name: String,
    sector: String,
    type: String,
    lat: Number,
    lon: Number,
    crag_name: String,
    crag_id: Number,
  }
  */

// Maps ratings to a number scale.
var rating_map = {
  '3': 1, '4': 2, '5a': 3, '5b': 4, '5c': 5, '6a': 6,  '6a+': 6, '6b': 8,
  '6b+': 9, '6c': 10, '6c+': 11, '7a': 12, '7a+': 13, '7b': 14, '7b+': 15,
  '7c': 16, '7c+': 17, '8a': 18, '8a+': 19, '8b': 20, '8b+': 21, '8c': 22,
  '8c+': 23, '9a': 24, '9a+': 25, '9b': 26, '9b+': 27, '9c': 28, '9c+': 29,
};

// Add a crag to cartodb.
function mapCrag(c, cb) {
  var names = ["id", "name", "country", "country_code",
              "boulders", "routes", "boulder_grade", "route_grade"];
  var values = [c.id, "'" + c.name + "'", "'" + c.country + "'",
                "'" + c.country_code + "'", c.boulders,
                c.routes, c.boulder_grade, c.route_grade];
  if (c.lat && c.lon) {
    names.unshift("the_geom");
    values.unshift("CDB_LatLng(" + c.lat + "," + c.lon + ")");
  }
  if (c.city) {
    names.push("city");
    values.push("'" + c.city + "'");
  }
  var q = "INSERT INTO crags (" + _.join(",", names)
          + ") VALUES (" + _.join(",", values) + ")";
  request.post({
    uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    qs: {
      q: q,
      api_key: cartodb.api_key
    }
  }, function (err, res, body) {
    errCheck(err, res);
    log('Mapped crag: ' + clc.underline(c.name));
    if (cb) cb();
  });
}

// Add an ascent to cartodb.
function mapAscent(a, cb) {
  var names = ["grade", "name", "type", "crag_name", "crag_id"];
  var values = [a.grade, "'" + a.name + "'", "'" + a.type + "'",
                "'" + a.crag_name + "'", a.crag_id];
  if (a.lat && a.lon) {
    names.unshift("the_geom");
    values.unshift("CDB_LatLng(" + a.lat + "," + a.lon + ")");
  }
  if (a.sector) {
    names.push("sector");
    values.push("'" + a.sector + "'");
  }
  var q = "INSERT INTO ascents (" + _.join(",", names)
          + ") VALUES (" + _.join(",", values) + ")";
  request.post({
    uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    qs: {
      q: q,
      api_key: cartodb.api_key
    }
  }, function (err, res, body) {
    errCheck(err, res);
    log('Mapped ascent: ' + clc.underline(a.name));
    if (cb) cb();
  });
}

// Walk steps.
Step(

  // Clear crags cartodb table.
  function () {
    log(clc.blue('Wiping cartodb crags table...'))
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM crags',
        api_key: cartodb.api_key
      }
    }, this);
  },

  // Clear ascents cartodb table.
  function () {
    log(clc.blue('Wiping cartodb ascents table...'))
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM ascents',
        api_key: cartodb.api_key
      }
    }, this);
  },

  // Get the global 8a.nu crags page.
  function () {
    log(clc.blue('Getting countries...'));
    request.get({
      uri: 'http://www.8a.nu/crags/List.aspx',
      qs: {CountryCode: 'GLOBAL'},
    }, this.parallel());
    log(clc.blue('Getting crag latlongs...'));
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
    var match;
    while ((match = country_rx.exec(list.body)))
      countries[match[1]] = format(match[2]);
    if (_.size(countries) === 0)
      errCheck(clc.red('No countries found.'));
    log('Found ' + clc.green(_.size(countries)) + ' countries.');
    // Map:
    var match;
    while ((match = geo_rx.exec(map.body)) !== null)
      points[Number(match[1])] = {
            lat: Number(match[2]), lon: Number(match[3])};
    log('Found ' + clc.green(_.size(points)) + ' crag locations.');
    this();
  },

  // Get crags from each country.
  function () {
    log(clc.blue('Getting crags...'));
    var types = [0, 1];
    var next = _.after(_.size(countries) * types.length, this);
    _.each(countries, function (v, k) {
      _.each(types, function (t) {
        var type = t ? 'boulder' : 'route';
        request.get({
          uri: 'http://www.8a.nu/crags/List.aspx',
          qs: {
            CountryCode: k,
            AscentType: t,
          },
        }, function (err, res, body) {
          errCheck(err, res);
          var cs = [];
          var match;
          while ((match = crag_rx.exec(body))) {
            var c = {
              id: Number(match[1].trim()),
              name: format(match[2]),
              country: v,
              country_code: k,
            };
            if (match[4] && match[4].trim() !== '')
              c.city = format(match[4]);
            cs.push(c);
          }
          log('Found ' + clc.green(cs.length) + ' ' + clc.italic(type)
              + ' crags in ' + clc.underline(v) + '.');
          crags.push(cs);
          next();
        });
      });
    });
  },

  // Join crags and crag points.
  function () {
    crags = _.reduceRight(crags, function (a, b) {
      return a.concat(b); }, []);
    log('Found ' + clc.green(crags.length) + ' crags.');
    _.each(crags, function (c) {
      if (points[c.id] !== undefined)
        _.extend(c, points[c.id]);
    });
    // crags = _.first(crags, 10);
    this();
  },

  // Get the ascents from each crag.
  function () {
    log(clc.blue('Getting ascents...'));
    if (crags.length === 0)
      this();
    var next = this;
    var types = [0, 1];
    var batchSize = 100;
    var batchDelay = 1000;
    var batches = [[]];
    var cnt = 0;
    _.each(crags, function (c) {
      var last = _.last(batches);
      if (last.length < batchSize)
        last.push(c);
      else batches.push([c]);
    });
    
    // Do post requests in batches.
    (function post(batch) {
      cnt += batch.length;
      var _next = _.after(batch.length * types.length, function () {
        if (batches.length !== 0) {
          var complete = Math.round((cnt / crags.length) * 100);
          log('Found ascents from ' + clc.green(complete + '%') + ' of crags.');
          log(clc.blue('Waiting...'));
          _.delay(function () {
            post(batches.shift());
          }, batchDelay);
        } else next();
      });
      _.each(batch, function (c) {
        _.each(types, function (t) {
          var type = t ? 'boulder' : 'route';
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
            var grades = 0;
            var match_row;
            while (match_row = ascent_row_rx.exec(body)) {
              var m = match_row[0].match(ascent_rx);
              if (!m) continue;
              var a = {
                grade: m[1].trim(),
                name: format(m[2]),
                type: type,
                crag_name: c.name,
                crag_id: c.id,
              };
              if (m[5] && m[5].trim() !== '')
                a.sector = format(m[5]);
              if (c.lat && c.lon) {
                a.lat = c.lat;
                a.lon = c.lon;
              }
              a.grade = a.grade ? rating_map[a.grade.toLowerCase()] || 0 : 0;
              grades += a.grade;
              as.push(a);
              mapAscent(a);
            }
            c[type + 's'] = as.length;
            c[type + '_grade'] = as.length !== 0 ? grades / as.length : 0;
            log('Found ' + clc.green(as.length) + ' ' + clc.italic(type + 's')
                + ' in ' + clc.underline(c.name) + ' (GRADE_AVG='
                + clc.magenta(c[type + '_grade']) + ').');
            ++ascents;
            _next();
          });
        });
      });
    })(batches.shift());
  },

  // // Join ascents.
  // function () {
  //   ascents = _.reduceRight(ascents, function (a, b) {
  //     return a.concat(b); }, []);
  //   log('Found ' + clc.green(ascents.length) + ' ascents.');
  //   this();
  // },

  // // Clear crags cartodb table.
  // function () {
  //   log(clc.blue('Wiping cartodb crags table...'))
  //   request.post({
  //     uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
  //     qs: {
  //       q: 'DELETE FROM crags',
  //       api_key: cartodb.api_key
  //     }
  //   }, this);
  // },

  // Add crags to cartodb.
  function () {
    if (crags.length === 0)
      this();
    var next = _.after(crags.length, this);
    _.each(crags, function (c) {
      mapCrag(s, next);
    });
  },

  // // Clear ascents cartodb table.
  // function () {
  //   log(clc.blue('Wiping cartodb ascents table...'))
  //   request.post({
  //     uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
  //     qs: {
  //       q: 'DELETE FROM ascents',
  //       api_key: cartodb.api_key
  //     }
  //   }, this);
  // },

  // // Add ascents to cartodb.
  // function (err, res, body) {
  //   log(clc.blue('Mapping new cartodb ascents table...'))
  //   errCheck(err, res);
  //   if (ascents.length === 0)
  //     this();
  //   var next = _.after(ascents.length, this);
  //   _.each(ascents, function (a) {
  //     var names = ["grade", "name", "type", "crag_name", "crag_id"];
  //     var values = [a.grade, "'" + a.name + "'", "'" + a.type + "'",
  //                   "'" + a.crag_name + "'", a.crag_id];
  //     if (a.lat && a.lon) {
  //       names.unshift("the_geom");
  //       values.unshift("CDB_LatLng(" + a.lat + "," + a.lon + ")");
  //     }
  //     if (a.sector) {
  //       names.push("sector");
  //       values.push("'" + a.sector + "'");
  //     }
  //     var q = "INSERT INTO ascents (" + _.join(",", names)
  //             + ") VALUES (" + _.join(",", values) + ")";
  //     request.post({
  //       uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
  //       qs: {
  //         q: q,
  //         api_key: cartodb.api_key
  //       }
  //     }, function (err, res, body) {
  //       errCheck(err, res);
  //       log('Mapped ascent: ' + clc.underline(a.name));
  //       next();
  //     });
  //   });
  // },

  // Done.
  function (err) {
    errCheck(err);
    log(clc.blue('\nSuccessfully scraped 8a.nu.'));
    log('Found ' + clc.green(crags.length)
        + ' crags and ' + clc.green(ascents) + ' ascents.\n');
    process.exit(0);
  }
);
