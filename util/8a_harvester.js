#!/usr/bin/env node

var request = require('request');
var mongodb = require('mongodb');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var ClimbDb = require('../climb_db.js').ClimbDb;
var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var iconv = new require('iconv').Iconv('ISO-8859-1', 'UTF-8');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var clc = require('cli-color');
var optimist = require('optimist');
var argv = optimist
    .default('db', 'mongodb://localhost:27018/nodejitsu_sanderpick_nodejitsudb9750563292')
    .boolean('pro')
    .boolean('clear')
    .boolean('verbose')
    .boolean('really_verbose')
    .argv;

// Errors wrapper.
function errCheck(err) {
  if (err) {
    error(clc.red(err.stack));
    process.exit(1);
  };
}

// Format title strings.
function format(str) {
  return _.capitalize(str.trim());
}

// Batches an array.
function batcher(a, s) {
  var b = [[]];
  _.each(a, function (i) {
    var last = _.last(b);
    if (last.length < s)
      last.push(i);
    else b.push([i]);
  });
  return b;
}

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) '
                + 'AppleWebKit/537.17 (KHTML, like Gecko) '
                + 'Chrome/24.0.1312.57 Safari/537.17',
};

// CartoDB creds:
var cartodb = {
  user: 'island',
  api_key: '883965c96f62fd219721f59f2e7c20f08db0123b'
};

// MongoDB instance:
var db;

// Matches crag anchor tags:
var country_rx = new RegExp(/CountryCode=([A-Z]{3})">([^<]+)</gi);

// Matches google maps latlong point for a crag:
var geo_rx = new RegExp(/var point_([0-9]+) = new GLatLng\(([-0-9\.]+), ([-0-9\.]+)\);/gi);

// Matches crag anchor tags:
var crag_rx = new RegExp(/<a.+?CragId=([0-9]+).+?TITLE='(.+?)';.+?Country: ([^<]+)<br>City: ([^<]+)?<br>/gi);

// Matches ascent tr tags:
var ascent_row_rx = new RegExp(/<tr class='Height20'.+?<\/tr>/gi);

// Matches ascent details:
var ascent_rx = /^<tr class='Height20'.+?<td><b>([^<]+)<\/b><\/td><td>([^<]+)<\/td>.+">(.+)<\/a>( \/ (.+))?<\/td><\/tr>$/;

// Open object for crag points:
var points = {
  /*
  'ID': {
    lat: Number,
    lon: Number,
  }
  */
};

// Open list for countries:
var countries = [
  /*
  {
    _id: String,
    key: String,
    name: String,
    bcnt: Number,
    rcnt: Number,
    bgrd: Number,
    rgrd: Number,
    lat: Number,
    lon: Number,
  }
  */
];

// Open crag counter:
var crag_cnt = 0;

// Open ascent counter:
var ascent_cnt = 0;

// Maps ratings to a number scale.
var rating_map = {
  '3': 1, '4': 2, '5a': 3, '5b': 4, '5c': 5, '6a': 6,  '6a+': 6, '6b': 8,
  '6b+': 9, '6c': 10, '6c+': 11, '7a': 12, '7a+': 13, '7b': 14, '7b+': 15,
  '7c': 16, '7c+': 17, '8a': 18, '8a+': 19, '8b': 20, '8b+': 21, '8c': 22,
  '8c+': 23, '9a': 24, '9a+': 25, '9b': 26, '9b+': 27, '9c': 28, '9c+': 29,
};

// Add a crag to cartodb.
function mapCountry(y, cb) {
  var names = ["id", "name", "key", "bccnt", "rccnt",
              "bcnt", "rcnt", "bgrd", "rgrd"];
  var values = ["'" + y._id.toString() + "'", "'" + y.name + "'",
                "'" + y.key + "'", y.bccnt, y.rccnt,
                y.bcnt, y.rcnt, y.bgrd, y.rgrd];
  var q = "INSERT INTO countries (" + _.join(",", names)
          + ") VALUES (" + _.join(",", values) + ")";
  request.post({
    uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    qs: {
      q: q,
      api_key: cartodb.api_key
    }
  }, function (err, res, body) {
    errCheck(err);
    if (argv.really_verbose)
      log(clc.bold('Mapped') + ' country: ' + clc.underline(y.name));
    if (cb) cb();
  });
}

// Add a crag to cartodb.
function mapCrag(c, cb) {
  var names = ["id", "name", "type", "country", "country_key",
              "bcnt", "rcnt", "bgrd", "rgrd", "country_id"];
  var values = ["'" + c._id.toString() + "'", "'" + c.name + "'",
                "'" + c.type + "'", "'" + c.country + "'",
                "'" + c.country_key + "'", c.bcnt, c.rcnt, c.bgrd, c.rgrd,
                "'" + c.country_id + "'"];
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
    errCheck(err);
    if (argv.really_verbose)
      log(clc.bold('Mapped') + ' crag: ' + clc.underline(c.name));
    if (cb) cb();
  });
}

// Add an ascent to cartodb.
function mapAscent(a, cb) {
  var names = ["id", "name", "grade", "type", "crag",
              "country", "country_key", "country_id", "crag_id"];
  var values = ["'" + a._id.toString() + "'", "'" + a.name + "'", a.grade,
                "'" + a.type + "'", "'" + a.crag + "'", "'" + a.country + "'",
                "'" + a.country_key + "'", "'" + a.country_id.toString() + "'",
                "'" + a.crag_id.toString() + "'"];
  if (a.lat && a.lon) {
    names.unshift("the_geom");
    values.unshift("CDB_LatLng(" + a.lat + "," + a.lon + ")");
  }
  if (a.sector) {
    names.push("sector");
    values.push("'" + a.sector + "'");
  }
  if (a.city) {
    names.push("city");
    values.push("'" + a.city + "'");
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
    errCheck(err);
    if (argv.really_verbose)
      log(clc.bold('Mapped') + ' ascent: ' + clc.underline(a.name));
    if (cb) cb();
  });
}

// Walk steps.
Step(

  // Connect to db:
  function () {
    var next = this;
    mongodb.connect(argv.pro
      ? 'mongodb://nodejitsu_sanderpick:as3nonkk9502pe1ugseg3mj9ev@ds043947'
      + '.mongolab.com:43947/nodejitsu_sanderpick_nodejitsudb9750563292'
      : argv.db,
      {
        server: { poolSize: 4 },
        db: { native_parser: false, reaperTimeout: 600000 },
      }, function (err, db) {
      errCheck(err);
      new ClimbDb(db, { ensureIndexes: false }, next);
    });
  },
  function (err, _db) {
    errCheck(err);
    db = _db;
    this();
  },

  // Clear data.
  function () {
    if (!argv.clear) return this();
    log(clc.blue('Clearing cartodb tables...'));
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM crags',
        api_key: cartodb.api_key
      }
    }, this.parallel());
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM ascents',
        api_key: cartodb.api_key
      }
    }, this.parallel());
    log(clc.blue('Clearing mongodb collections...'));
    db.collections.country.drop(this.parallel());
    db.collections.crag.drop(this.parallel());
    db.collections.ascent.drop(this.parallel());
  },

  // Get the global 8a.nu crags page.
  function () {
    log(clc.blue('Getting countries...'));
    request.get({
      uri: 'http://www.8a.nu/crags/List.aspx',
      qs: {CountryCode: 'GLOBAL'},
      encoding: 'binary',
    }, this.parallel());
    log(clc.blue('Getting crag latlongs...'));
    request.get({
      uri: 'http://www.8a.nu/crags/MapCrags.aspx',
      qs: {CountryCode: 'GLOBAL'},
      headers: headers,
      encoding: 'binary',
    }, this.parallel());
  },

  // Parse out country codes from the HTML response.
  function (err, list, map) {
    errCheck(err);
    // List:
    list.body = iconv.convert(new Buffer(list.body, 'binary')).toString();
    var match;
    while ((match = country_rx.exec(list.body)))
      if (!_.find(countries, function (c) {
          return c.key === match[1].toLowerCase();}))
        countries.push({
          _id: new ObjectID(),
          key: match[1].toLowerCase(),
          name: format(match[2])
        });
    if (countries.length === 0)
      errCheck('No countries found.');
    log(clc.bold('Found ') + clc.green(countries.length)
        + ' countries.');
    // Map:
    map.body = iconv.convert(new Buffer(map.body, 'binary')).toString();
    var match;
    while ((match = geo_rx.exec(map.body)) !== null)
      points[Number(match[1])] = {
            lat: Number(match[2]), lon: Number(match[3])};
    log(clc.bold('Found ') + clc.green(_.size(points))
        + ' crag locations.');
    this();
  },

  // Handle each country completely, then the next...
  function () {
    if (countries.length === 0)
      return this();
    var done = this;
    var y = 0;

    // Get
    (function handle(country) {
      // Open list for crags:
      var crags = [
        /*
        {
          _id: String,
          name: String,
          country: String,
          country_key: String,
          city: String,
          bcnt: Number,
          rcnt: Number,
          bgrd: Number,
          rgrd: Number,
          lat: Number,
          lon: Number,
          country_id: String,
        }
        */
      ];

      // Open list for ascents:
      var ascents = [
        /*
        {
          _id: String,
          name: String,
          grade: Number,
          type: String,
          sector: String,
          crag: String,
          city: String,
          country: String,
          country_key: String,
          lat: Number,
          lon: Number,
          country_id: String,
          crag_id: String,
        }
        */
      ];

      // Grade averages.
      country.bcnt = 0; 
      country.rcnt = 0;
      country.bgrd = 0;
      country.rgrd = 0;

      // Walk steps.
      Step(
        // Get crags.
        function () {
          log(clc.blue('Getting crags from '
              + clc.underline(country.name) + '.'));
          var types = [0, 1];
          var next = _.after(types.length, this);
          _.each(types, function (t) {
            var type = t ? 'b' : 'r';
            request.get({
              uri: 'http://www.8a.nu/crags/List.aspx',
              qs: {
                CountryCode: country.key.toUpperCase(),
                AscentType: t,
              },
              encoding: 'binary',
            }, function (err, res, body) {
              errCheck(err);
              body = iconv.convert(new Buffer(body, 'binary')).toString();
              var cs = [];
              var match;
              while ((match = crag_rx.exec(body))) {
                var c = {
                  _id: new ObjectID(),
                  name: format(match[2]),
                  type: t,
                  country: country.name,
                  country_key: country.key,
                  country_id: country._id,
                  id: Number(match[1].trim()),
                };
                if (match[4] && match[4].trim() !== '')
                  c.city = format(match[4]);
                ++crag_cnt;
                cs.push(c);
              }
              country[type + 'ccnt'] = cs.length;
              if (argv.verbose || argv.really_verbose)
                log(clc.bold('Found ') + clc.green(cs.length)
                    + ' ' + clc.italic(t ? 'boulder' : 'route')
                    + ' crags in ' + clc.underline(country.name) + '.');
              crags.push(cs);
              next();
            });
          });
        },

        // Join crags and crag points.
        function () {
          crags = _.reduceRight(crags, function (a, b) {
            return a.concat(b); }, []);
          _.each(crags, function (c) {
            if (points[c.id] !== undefined)
              _.extend(c, points[c.id]);
            delete c.id;
          });
          this();
        },

        // Get the ascents from each crag.
        function () {
          if (crags.length === 0)
            return this();
          // crags = _.first(crags, 2);
          var next = this;
          var types = [0, 1];
          var batchDelay = 1000;
          var batches = batcher(crags, 100);
          var cnt = 0;

          // Do post requests in batches.
          (function post(batch) {
            log(clc.blue('Getting ascents...'));
            cnt += batch.length;
            var _next = _.after(batch.length * types.length, function() {
              if (batches.length !== 0) {
                var complete = Math.round((cnt / crags.length) * 100);
                log(clc.bold('Found') + ' ascents from '
                    + clc.green(complete + '%') + ' of crags.');
                log(clc.blue('Waiting...'));
                _.delay(function() {
                  post(batches.shift());
                }, batchDelay);
              } else next();
            });
            _.each(batch, function (c) {
              _.each(types, function (t) {
                var type = t ? 'b' : 'r';
                request.get({
                  uri: 'http://www.8a.nu/scorecard/Search.aspx',
                  qs: {
                    Mode: '',
                    AscentType: t,
                    CragName: c.name,
                  },
                  headers: headers,
                  encoding: 'binary',
                }, function (err, res, body) {
                  errCheck(err);
                  body = iconv.convert(new Buffer(body, 'binary')).toString();
                  var as = [];
                  var g = 0;
                  var match_row;
                  while (match_row = ascent_row_rx.exec(body)) {
                    var m = match_row[0].match(ascent_rx);
                    if (!m) continue;
                    var a = {
                      _id: new ObjectID(),
                      name: format(m[2]),
                      grade: m[1].trim(),
                      type: type,
                      crag: c.name,
                      country: c.country,
                      country_key: c.country_key,
                      country_id: c.country_id,
                      crag_id: c._id,
                    };
                    if (m[5] && m[5].trim() !== '')
                      a.sector = format(m[5]);
                    if (c.city)
                      a.city = c.city;
                    if (c.lat && c.lon) {
                      a.lat = c.lat;
                      a.lon = c.lon;
                    }
                    a.grade = a.grade ? rating_map[a.grade.toLowerCase()] || 0 : 0;
                    g += a.grade;
                    ++ascent_cnt;
                    as.push(a);
                  }
                  c[type + 'cnt'] = as.length;
                  c[type + 'grd'] = as.length !== 0 ? g / as.length : 0;
                  country[type + 'cnt'] += as.length;
                  country[type + 'grd'] += g;
                  if (argv.verbose || argv.really_verbose)
                    log(clc.bold('Found ') + clc.green(as.length)
                        + ' ' + clc.italic(t ? 'boulders' : 'routes')
                        + ' in ' + clc.underline(c.name) + ' (GRADE_AVG='
                        + clc.magenta(c[type + 'grd']) + ').');
                  ascents.push(as);
                  _next();
                });
              });
            });
          })(batches.shift());
        },

        // Join ascents.
        function () {
          ascents = _.reduceRight(ascents, function (a, b) {
            return a.concat(b); }, []);
          this();
        },

        // Map ascents.
        function () {
          if (ascents.length === 0)
            return this();
          log(clc.blue('Mapping ascents...'));
          var next = _.after(ascents.length, this);
          _.each(ascents, function (a) {
            mapAscent(a, next);
          });
        },

        // Save ascents.
        function () {
          if (ascents.length === 0)
            return this();
          log(clc.blue('Saving ascents...'));
          var next = _.after(ascents.length, this);
          _.each(ascents, function (a) {
            db.createAscent(a, function (err) {
              errCheck(err);
              if (argv.really_verbose)
                log(clc.bold('Saved') + ' ascent: ' + clc.underline(a.name));
              next();
            });
          });
        },

        // Map crags.
        function (err) {
          errCheck(err);
          if (crags.length === 0)
            return this();
          log(clc.blue('Mapping crags...'));
          var next = _.after(crags.length, this);
          _.each(crags, function (c) {
            mapCrag(c, next);
          });
        },

        // Save crags.
        function (err) {
          errCheck(err);
          if (crags.length === 0)
            return this();
          log(clc.blue('Saving crags...'));
          var next = _.after(crags.length, this);
          _.each(crags, function (c) {
            db.createCrag(c, function (err) {
              errCheck(err);
              if (argv.really_verbose)
                log(clc.bold('Saved') + ' crag: ' + clc.underline(c.name));
              next();
            });
          });
        },

        // Get country stats and save.
        function (err) {
          errCheck(err);
          country.bgrd = country.bcnt !== 0 ? country.bgrd / country.bcnt : 0;
          country.rgrd = country.rcnt !== 0 ? country.rgrd / country.rcnt : 0;
          log(clc.blue('Saving ' + clc.underline(country.name)));
          db.createCountry(country, function (err) {
            errCheck(err);
            ++y;
            if (y === countries.length)
              return done();
            log(clc.blue('Mapping ' + clc.underline(country.name)));
            mapCountry(country, function (err) {
              log(clc.blue((countries.length - y) + ' countries left.'));
              handle(countries[y]);
            });
          });  
        }
      );
    })(countries[y]);
  },

  // Done.
  function () {
    log(clc.blue('\nSuccessfully scraped 8a.nu.'));
    log(clc.bold('Found ') + clc.green(countries.length) + ' countries, '
        + clc.green(crag_cnt) + ' crags, and '
        + clc.green(ascent_cnt) + ' ascents.\n');
    process.exit(0);
  }
);
