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
    .default('db', 'mongodb://localhost:27018/nodejitsu_sanderpick_nodejitsudb9750563292')
    .boolean('pro')
    .boolean('clear')
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
  return _.capitalize(str.trim()).replace(/\\/g, '');
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

// Add a country to cartodb.
function mapCountry(record, cb) {
  var names = ["id", "name", "key", "bccnt", "rccnt",
              "bcnt", "rcnt", "bgrd", "rgrd"];
  var values = ["'" + record._id.toString() + "'",
                "'" + clean(record.name) + "'",
                "'" + record.key + "'", record.bccnt, record.rccnt,
                record.bcnt, record.rcnt, record.bgrd, record.rgrd];
  var q = "INSERT INTO countries (" + _.join(",", names)
          + ") VALUES (" + _.join(",", values) + ")";
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
    log(clc.blue('Mapped ') + clc.underline(record.name) + '.');
    cb();
  });
}

// Add a crag to cartodb.
function mapCrags(records, country, cb) {
  var names = ["the_geom", "id", "name", "city", "type",
              "bcnt", "rcnt", "bgrd", "rgrd", "bgrdt", "rgrdt",
              "country_id", "key"];
  var q = "INSERT INTO crags2 (" + _.join(",", names)
          + ") VALUES ";
  _.each(records, function (r, i) {
    q += "(" + _.join(",", [r.lat && r.lon ?
                      "CDB_LatLng(" + r.lat + "," + r.lon + ")" : "NULL",
                      "'" + r._id.toString() + "'",
                      "'" + clean(r.name) + "'",
                      r.city ? "'" + clean(r.city) + "'" : "NULL",
                      r.type ? "'" + r.type + "'" : "NULL",
                      r.bcnt, r.rcnt, r.bgrd, r.rgrd,
                      r.bgrdt ? "'" + r.bgrdt + "'" : "NULL",
                      r.rgrdt ? "'" + r.rgrdt + "'" : "NULL",
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

// Add a crag to cartodb using seperate tables for boulder and routes.
function mapCragsSeperate(records, country, cb) {
  var names = ["the_geom", "id", "name", "city", "country_id", "cnt", "grd"];
  var sql = {
    boulder: { q: "INSERT INTO boulders ("
                + _.join(",", names) + ") VALUES ", n: 0},
    route: { q: "INSERT INTO routes ("
                + _.join(",", names) + ") VALUES ", n: 0}
  };
  _.each(records, function (r, i) {
    var vals = [r.lat && r.lon ?
                "CDB_LatLng(" + r.lat + "," + r.lon + ")" : "NULL",
                "'" + r._id.toString() + "'",
                "'" + clean(r.name) + "'",
                r.city ? "'" + clean(r.city) + "'" : "NULL",
                "'" + r.country_id + "'"];
    if (r.bcnt > 0) {
      var row = "(" + _.join(",", vals.concat([r.bcnt, r.bgrd])) + ")";
      sql.boulder.q += sql.boulder.n ? ',' + row : row;
      ++sql.boulder.n;
    }
    if (r.rcnt > 0) {
      var row = "(" + _.join(",", vals.concat([r.rcnt, r.rgrd])) + ")";
      sql.route.q += sql.route.n ? ',' + row : row;
      ++sql.route.n;
    }
  });
  var _cb = _.after(_.size(sql), cb);
  _.each(sql, function (v, k) {
    if (v.n === 0) return _cb();
    curl.request({
      url: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      method: 'POST',
      data: {q: v.q, api_key: cartodb.api_key}
    }, function (err, data) {
      errCheck(err);
      if (data) {
        data = JSON.parse(data);
        errCheck(data.error);
      }
      log(clc.blue('Mapped ') + clc.green(records.length)
          + ' ' + k + ' crags in ' + clc.underline(country) + '.');
      _cb();
    });
  });
}

// Add an ascents to cartodb.
function mapAscents(records, country, cb) {
  var names = ["id", "name", "grade", "type",
              "country_id", "crag_id", "sector"];
  var q = "INSERT INTO ascents (" + _.join(",", names)
          + ") VALUES ";
  _.each(records, function (r, i) {
    q += "(" + _.join(",", ["'" + r._id.toString() + "'",
                      "'" + clean(r.name) + "'", r.grade,
                      "'" + r.type + "'",
                      "'" + r.country_id.toString() + "'",
                      "'" + r.crag_id.toString() + "'",
                      r.sector ? "'" + clean(r.sector) + "'" : "NULL"]) + ")";
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
    log(clc.blackBright('Mapped ') + clc.green(records.length)
        + ' ascents in ' + clc.underline(country) + '.');
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
    log(clc.red('Clearing cartodb tables...'));
    // request.post({
    //   uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    //   qs: {
    //     q: 'DELETE FROM countries',
    //     api_key: cartodb.api_key
    //   }
    // }, this.parallel());
    request.post({
      uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
      qs: {
        q: 'DELETE FROM crags2',
        api_key: cartodb.api_key
      }
    }, this.parallel());
    // request.post({
    //   uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    //   qs: {
    //     q: 'DELETE FROM boulders',
    //     api_key: cartodb.api_key
    //   }
    // }, this.parallel());
    // request.post({
    //   uri: 'https://' + cartodb.user + '.cartodb.com/api/v2/sql',
    //   qs: {
    //     q: 'DELETE FROM routes',
    //     api_key: cartodb.api_key
    //   }
    // }, this.parallel());
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
          bgrd: Number,
          rgrd: Number,
          bgrdt: String,
          rgrdt: String,
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
              var cs = [];
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
                ++crag_cnt;
                cs.push(c);
              }
              country[type + 'ccnt'] = cs.length;
              log(clc.cyan('Found ') + clc.green(cs.length)
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
                  c[type + 'grdt'] = map_rating[Math.round(c[type + 'grd'])];
                  country[type + 'cnt'] += as.length;
                  country[type + 'grd'] += g;
                  log(clc.cyan('Found ') + clc.green(as.length)
                      + ' ' + clc.italic(t ? 'boulders' : 'routes')
                      + ' in ' + clc.underline(c.name) + ' (GRADE_AVG='
                      + clc.magenta(c[type + 'grd']) + ').');
                  ascents.push(as);
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
          // Skip mapping for now.
          // if (ascents.length === 0)
          //   return this();
          // var q = async.queue(function (b, cb) {
          //   mapAscents(b, country.name, cb);
          // }, 10);
          // q.drain = this;
          // q.push(batcher(ascents, 500), function (err) {
          //   errCheck(err);
          // });
        },

        // Save crags.
        function (err) {
          errCheck(err);
          if (crags.length === 0)
            return this();
          var next = _.after(crags.length, this);
          _.each(crags, function (c) {
            if (c.bcnt > 0 && c.rcnt === 0)
              c.type = 'b';
            else if (c.bcnt === 0 && c.rcnt > 0)
              c.type = 'r';
            else if (c.bcnt > 0 && c.rcnt > 0)
              c.type = 'c';
            else c.type = 'n';
            db.createCrag(c, function (err, doc) {
              errCheck(err);
              c.key = doc.key;
              next();
            });
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
          country.bgrd = country.bcnt !== 0 ? country.bgrd / country.bcnt : 0;
          country.rgrd = country.rcnt !== 0 ? country.rgrd / country.rcnt : 0;
          country.bgrdt = map_rating[Math.round(country.bgrd)];
          country.rgrdt = map_rating[Math.round(country.rgrd)];
          db.createCountry(country, function (err) {
            errCheck(err);
            log(clc.orange('Saved ') + clc.underline(country.name) + '.');
            ++y;
            if (y === countries.length)
              return done();
            // Skip mapping for now.
            // mapCountry(country, function (err) {
            //   log(clc.blackBright((countries.length - y) + ' countries left.'));
            //   handle(countries[y]);
            // });
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
