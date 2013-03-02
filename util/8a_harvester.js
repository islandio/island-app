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

// Format title strings.
function format(str) {
  return encodeURIComponent(_.capitalize(str.trim()));
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
var country_rx = new RegExp(/CountryCode=([A-Z]{3}?)">(.*?)</gi);

// Matches crag anchor tags:
var crag_rx = new RegExp(/<a.*?CragId=([0-9]+).*?TITLE='(.*?)'.*?Country: (.*?)<br>City: (.*?)<br>.*?<\/a>/gi);

// Matches google maps latlong point for a crag:
var geo_rx = new RegExp(/var point_(.*?) = new GLatLng\((.*?), (.*?)\);/gi);

// Matches ascent tr tags:
var ascent_rx = new RegExp(/<tr.*?class='Height20'.*?<td><b>(.*?)<\/b><\/td><td>(.*?)<\/td><td>.*?<\/td><td>.*?<\/td><td><a.*?<\/a> \/ (.*?)<\/td>/gi);

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
      countries[match[1]] = format(match[2]);
    if (_.size(countries) === 0)
      errCheck('No countries found.');
    log('Found ' + _.size(countries) + ' countries.');
    // Map:
    while ((match = geo_rx.exec(map.body)) !== null)
      points[Number(match[1])] = {
            lat: Number(match[2]), lon: Number(match[3])};
    log('Found ' + _.size(points) + ' crag locations.');
    this();
  },

  // Get crags from each country.
  function () {
    var types = [0, 1];
    var next = _.after(_.size(countries) * types.length, this);
    _.each(countries, function (v, k) {
      _.each(types, function (t) {
        request.get({
          uri: 'http://www.8a.nu/crags/List.aspx',
          qs: {
            CountryCode: k,
            AscentType: t,
          },
        }, function (err, res, body) {
          errCheck(err, res);
          var cs = [];
          while ((match = crag_rx.exec(body)) !== null) {
            var c = {
              id: Number(match[1].trim()),
              name: format(match[2]),
              country: v,
              country_code: k,
            };
            if (match[4].trim() !== '')
              c.city = format(match[4]);
            cs.push(c);
          }
          log('Found ' + cs.length + (t ? ' boulder' : ' route')
              + ' crags in ' + v + '.');
          crags.push(cs);
          next();
        });
      });
    });
  },

  // Join country crags and crag points.
  function () {
    crags = _.reduceRight(crags, function (a, b) {
      return a.concat(b); }, []);
    log('Found ' + crags.length + ' crags on Earth.');
    _.each(crags, function (c) {
      if (points[c.id] !== undefined)
        _.extend(c, points[c.id]);
    });
    this();
  },

  // // Get the ascents from each crag.
  // function () {
  //   // crags = _.first(crags, 2);
  //   if (crags.length === 0)
  //     this();
  //   var types = [0, 1];
  //   var next = _.after(crags.length * types.length, this);
  //   _.each(crags, function (c) {
  //     _.each(types, function (t) {
  //       request.get({
  //         uri: 'http://www.8a.nu/scorecard/Search.aspx',
  //         qs: {
  //           Mode: '',
  //           AscentType: t,
  //           CragName: c.name,
  //         },
  //         headers: headers,
  //       }, function (err, res, body) {
  //         errCheck(err, res);
  //         var as = [];
  //         while ((match = ascent_rx.exec(body)) !== null) {
  //           var a = {
  //             grade: match[1].trim(),
  //             name: format(match[2]),
  //             sector: match[3].trim() !== '' ? format(match[3]) : null,
  //             type: t ? 'boulder' : 'route',
  //             crag_name: c.name,
  //             crag_id: c.id,
  //           };
  //           as.push(a);
  //         }
  //         log('Found ' + as.length + (t ? ' boulders' : ' routes')
  //             + ' in ' + c.name + '.');
  //         ascents.push(as);
  //         next();
  //       });
  //     });
  //   });
  // },

  // // Join crag ascents.
  // function () {
  //   ascents = _.reduceRight(ascents, function (a, b) {
  //     return a.concat(b); }, []);
  //   log('Found ' + ascents.length + ' on Earth.');
  //   this();
  // },

  // Clear crags cartodb table:
  function () {
    log('Wiping cartodb crags...')
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM crags',
        api_key: cartodb.api_key
      }
    }, this);
  },

  // Add crags to cartodb
  function (err, res, body) {
    errCheck(err, res);
    if (crags.length === 0)
      this();
    var next = _.after(crags.length, this);
    _.each(crags, function (c) {
      var names = ["id", "name", "country", "country_code"];
      var values = [c.id, "'" + c.name + "'", "'" + c.country + "'",
                    "'" + c.country_code + "'"];
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
        log('Mapped ' + c.name + '.');
        next();
      });
    });
  },

  // Done.
  function (err) {
    errCheck(err);
    log('\nMy work here is done.\n');
    process.exit(0);
  }
);
