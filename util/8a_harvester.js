#!/usr/bin/env node

var request = require('request');
var curl = require('curlrequest');
var mongodb = require('mongodb');
var ObjectID = require('mongodb').BSONPure.ObjectID;
var ClimbDb = require('../climb_db.js').ClimbDb;
var iconv = new require('iconv').Iconv('ISO-8859-1', 'UTF-8');
var Step = require('step');
var async = require('async');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var clc = require('cli-color');
clc.orange = clc.xterm(202);
var log = function (s) {console.log(clc.bold(s));};
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var optimist = require('optimist');
var argv = optimist
    .demand('table')
    .describe('table', 'CartoDB table name')
    .boolean('pro')
    .describe('pro', 'Target production MongoDB instance')
    .boolean('clear')
    .describe('clear', 'Clear MongoDB collections and CartoDB tables')
    .argv;

// Errors wrapper.
function errCheck(err) {
  if (err) {
    error(clc.red(err.stack || err));
    process.exit(1);
  };
}

// Format title strings.
function format(str) {
  str = str.replace(/\\/g, '').trim();
  if (str.length > 3) str = str.toLowerCase();
  return _.map(str.split(' '), function (w) {
    return _.capitalize(w);
  }).join(' ');
}

// Format strings for SQL.
function clean(str) {
  return str.replace(/'/g, "''");
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

// Removes duplicate determined by an attribute.
function unique(arr, att) {
  var u = {}, r = [];
  _.each(arr, function (a) {
    if (!u[a[att]]) u[a[att]] = a;
  });
  _.each(u, function (v) {
    r.push(v);
  });
  return r;
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
    bgrdu: String,
    bgrdl: String,
    rgrdu: String,
    rgrdl: String,
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
  '3': 1, '4': 2, '5a': 3, '5b': 4, '5c': 5, '6a': 6,  '6a+': 7, '6b': 8,
  '6b+': 9, '6c': 10, '6c+': 11, '7a': 12, '7a+': 13, '7b': 14, '7b+': 15,
  '7c': 16, '7c+': 17, '8a': 18, '8a+': 19, '8b': 20, '8b+': 21, '8c': 22,
  '8c+': 23, '9a': 24, '9a+': 25, '9b': 26, '9b+': 27, '9c': 28, '9c+': 29,
};
var map_rating = {
  1: '3', 2: '4', 3: '5a', 4: '5b', 5: '5c', 6: '6a',  7: '6a+', 8: '6b',
  9: '6b+', 10: '6c', 11: '6c+', 12: '7a', 13: '7a+', 14: '7b', 15: '7b+',
  16: '7c', 17: '7c+', 18: '8a', 19: '8a+', 20: '8b', 21: '8b+', 22: '8c',
  23: '8c+', 24: '9a', 25: '9a+', 26: '9b', 27: '9b+', 28: '9c', 29: '9c+',
};
var grades = _.keys(rating_map);

// Add a crag to cartodb.
function mapCrags(records, country, cb) {
  var names = ["the_geom", "id", "name", "city",
              "bcnt", "rcnt", "bgrdu", "bgrdl", "rgrdu", "rgrdl",
              "country_id", "key"];
  var q = "INSERT INTO " + argv.table + " (" + _.join(",", names)
          + ") VALUES ";
  _.each(records, function (r, i) {
    q += "(" + _.join(",", [r.lat && r.lon ?
                      "CDB_LatLng(" + r.lat + "," + r.lon + ")" : "NULL",
                      "'" + r._id.toString() + "'",
                      "'" + clean(r.name) + "'",
                      r.city ? "'" + clean(r.city) + "'" : "NULL",
                      r.bcnt, r.rcnt,
                      "'" + r.bgrdu + "'", "'" + r.bgrdl + "'",
                      "'" + r.rgrdu + "'", "'" + r.rgrdl + "'",
                      "'" + r.country_id + "'",
                      "'" + r.key + "'"]) + ")";
    if (i !== records.length - 1) q += ", ";
  });
  curl.request({
    url: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    method: 'POST',
    data: {q: q, api_key: cartodb.api_key}
  }, function (err, data) {
    errCheck(err);
    if (data) {
      data = JSON.parse(data);
      errCheck(data.error);
    }
    log(clc.blue('Mapped ') + clc.green(records.length)
        + ' crags in ' + clc.underline(country) + '.');
    cb();
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
      : 'mongodb://localhost:27018/nodejitsu_sanderpick_nodejitsudb9750563292',
      {
        server: { poolSize: 4 },
        db: { native_parser: false, reaperTimeout: 600000 },
      }, function (err, db) {
      errCheck(err);
      new ClimbDb(db, { ensureIndexes: true }, next);
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
    log(clc.red('Clearing cartodb tables...'));
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM ' + argv.table,
        api_key: cartodb.api_key
      }
    }, this.parallel());
    log(clc.red('Clearing mongodb collections...'));
    db.collections.country.drop(this.parallel());
    db.collections.crag.drop(this.parallel());
    db.collections.ascent.drop(this.parallel());
  },

  // Get the global 8a.nu crags page.
  function () {
    log(clc.blackBright('Getting countries...'));
    request.get({
      uri: 'http://www.8a.nu/crags/List.aspx',
      qs: {CountryCode: 'GLOBAL'},
      encoding: 'binary',
    }, this.parallel());
    log(clc.blackBright('Getting crag latlongs...'));
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
    log(clc.cyan('Found ') + clc.green(countries.length)
        + ' countries.');
    // Map:
    map.body = iconv.convert(new Buffer(map.body, 'binary')).toString();
    var match;
    while ((match = geo_rx.exec(map.body)) !== null)
      points[Number(match[1])] = {
            lat: Number(match[2]), lon: Number(match[3])};
    log(clc.cyan('Found ') + clc.green(_.size(points))
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
          bgrdu: String,
          bgrdl: String,
          rgrdu: String,
          rgrdl: String,
          lat: Number,
          lon: Number,
          country_id: String,
          key: String,
        }
        */
      ];

      // Open list for ascents:
      var ascents = [
        /*
        {
          _id: String,
          name: String,
          grades: [String],
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

      // Stats.

      country.bcnt = 0; 
      country.rcnt = 0;
      country.bgrdu = _.min(grades);
      country.bgrdl = _.max(grades);
      country.rgrdu = _.min(grades);
      country.rgrdl = _.max(grades);

      // Walk steps.
      Step(
        // Get crags.
        function () {
          log(clc.blackBright('Getting crags in '
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
              var cs = {};
              var match;
              while ((match = crag_rx.exec(body))) {
                var c = {
                  _id: new ObjectID(),
                  name: format(match[2]),
                  country: country.name,
                  country_key: country.key,
                  country_id: country._id,
                  id: Number(match[1].trim()),
                };
                if (match[4] && match[4].trim() !== '')
                  c.city = format(match[4]);
                var slug = _.slugify(c.name);
                if (slug === '') continue;
                c.key = [c.country_key, slug].join('/');
                var e = cs[c.key];
                if (!e)
                  cs[c.key] = c;
                else {
                  e.city = e.city || c.city;
                  e.lat = e.lat || c.lat;
                  e.lon = e.lon || c.lon;
                }
              }
              cs = _.values(cs);
              country[type + 'ccnt'] = cs.length;
              if (cs.length > 0) {
                crags.push(cs);
                crag_cnt += cs.length;
                log(clc.cyan('Found ') + clc.green(cs.length)
                    + ' ' + clc.italic(t ? 'boulder' : 'route')
                    + ' crags in ' + clc.underline(country.name) + '.');
              }
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
          log(clc.blackBright('Getting ascents in '
              + clc.underline(country.name) + '.'));
          var next = this;
          var types = [0, 1];

          // Do post requests in batches.
          function post(batch, cb) {
            var _next = _.after(batch.length * types.length, cb);
            _.each(batch, function (c) {
              _.each(types, function (t) {
                var type = t ? 'b' : 'r';
                var fulltype = t ? 'boulders' : 'routes';
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
                  var as = {};
                  var gu = _.min(grades);
                  var gl = _.max(grades);
                  var match_row;
                  while (match_row = ascent_row_rx.exec(body)) {
                    var m = match_row[0].match(ascent_rx);
                    if (!m) continue;
                    var a = {
                      _id: new ObjectID(),
                      name: format(m[2]),
                      grade: m[1].trim().toLowerCase(),
                      type: type,
                      crag: c.name,
                      country: c.country,
                      country_key: c.country_key,
                      country_id: c.country_id,
                      crag_id: c._id,
                    };
                    if (m[5] && m[5].trim() !== '')
                      a.sector = format(m[5]);
                    var slug1 = _.slugify(a.crag);
                    var slug2 = _.slugify(a.name);
                    if (slug1 === '' || slug2 === '') continue;
                    a.key = [a.country_key, slug1, fulltype, slug2].join('/');
                    var grade = a.grade;
                    delete a.grade;
                    var e = as[a.key];
                    if (!e) {
                      a.grades = [grade];
                      as[a.key] = a;
                    } else {
                      e.sector = e.sector || a.sector;
                      var gnum = rating_map[grade];
                      if (gnum && !_.contains(e.grades, grade)) {
                        e.grades.push(grade);
                        if (gnum > rating_map[gu])
                          gu = grade;
                        if (gnum < rating_map[gl])
                          gl = grade;
                      }
                    }
                  }
                  as = _.values(as);
                  c[type + 'cnt'] = as.length;
                  c[type + 'grdu'] = gu;
                  c[type + 'grdl'] = gl;
                  country[type + 'cnt'] += as.length;
                  if (rating_map[gu] > rating_map[country[type + 'grdu']])
                    country[type + 'grdu'] = gu;
                  if (rating_map[gl] < rating_map[country[type + 'grdl']])
                    country[type + 'grdl'] = gl;
                  if (as.length > 0) {
                    ascents.push(as);
                    ascent_cnt += as.length;
                    log(clc.cyan('Found ') + clc.green(as.length)
                        + ' ' + clc.italic(fulltype)
                        + ' in ' + clc.underline(c.name)
                        + ' (GRADE_UPPER=' + clc.magenta(c[type + 'grdu'])
                        + ' GRADE_LOWER=' + clc.magenta(c[type + 'grdl'])
                        + ').');
                  }
                  _next();
                });
              });
            });
          };

          // Start task queue.
          var q = async.queue(function (b, cb) {
            post(b, cb);
          }, 10);
          q.drain = next;
          q.push(batcher(crags, 100), function (err) {
            errCheck(err);
          });
        },

        // Join ascents.
        function () {
          ascents = _.reduceRight(ascents, function (a, b) {
            return a.concat(b); }, []);
          this();
        },

        // Save ascents.
        function () {
          if (ascents.length === 0)
            return this();
          var next = _.after(ascents.length, this);
          _.each(ascents, function (a) {
            db.createAscent(a, next);
          });
        },

        // Map ascents.
        function (err) {
          errCheck(err);
          log(clc.orange('Saved ') + clc.green(ascents.length)
              + ' ascents in ' + clc.underline(country.name) + '.');
          this();
        },

        // Save crags.
        function (err) {
          errCheck(err);
          if (crags.length === 0)
            return this();
          var next = _.after(crags.length, this);
          _.each(crags, function (c) {
            db.createCrag(c, next);
          });
        },

        // Map crags.
        function (err) {
          log(clc.orange('Saved ') + clc.green(crags.length)
              + ' crags in ' + clc.underline(country.name) + '.');
          if (crags.length === 0)
            return this();
          var q = async.queue(function (b, cb) {
            mapCrags(b, country.name, cb);
          }, 10);
          q.drain = this;
          q.push(batcher(crags, 500), function (err) {
            errCheck(err);
          });
        },

        // Get country stats and save.
        function (err) {
          errCheck(err);
          db.createCountry(country, function (err) {
            errCheck(err);
            log(clc.orange('Saved ') + clc.underline(country.name) + '.');
            ++y;
            if (y === countries.length)
              return done();
            log(clc.blackBright((countries.length - y) + ' countries left.'));
            handle(countries[y]);
          });  
        }
      );
    })(countries[y]);
  },

  // Done.
  function () {
    log(clc.blackBright('\nSuccessfully scraped 8a.nu:'));
    log(clc.green(countries.length) + ' countries, '
        + clc.green(crag_cnt) + ' crags, and '
        + clc.green(ascent_cnt) + ' ascents.\n');
    process.exit(0);
  }
);
