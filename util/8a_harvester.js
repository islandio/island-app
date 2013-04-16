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
var ascent_row_rx = new RegExp(/<tr id='[0-9]+' class='Height20'.+?<\/tr>/gi);

// Matches ascent details:
var ascent_rx = /^<tr id='[0-9]+' class='Height20'[^>]+><td ><b>([^<]+)<\/b><\/td><td><a[^>]+>([^<]+)<\/a><\/td>.+[^>]<\/a>( \/ ([^<]+))?[^$]+$/;

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
    rgrdl: String
  }
  */
];

// Open crag counter:
var crag_cnt = 0;

// Open ascent counter:
var ascent_cnt = 0;

// Maps ratings to a number scale.
var rating_map = {
  '3': 0, '4': 1, '5a': 2, '5b': 3, '5c': 4, '6a': 5,  '6a+': 6, '6b': 7,
  '6b+': 8, '6c': 9, '6c+': 10, '7a': 11, '7a+': 12, '7b': 13, '7b+': 14,
  '7c': 15, '7c+': 16, '8a': 17, '8a+': 18, '8b': 19, '8b+': 20, '8c': 21,
  '8c+': 22, '9a': 23, '9a+': 24, '9b': 25, '9b+': 26, '9c': 27
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

      // Check if exists and has ascents.
      var okay = false;
      var doc;
      Step(
        function () {
          db.collections.country.findOne({key: country.key}, this);
        },
        function (err, d) {
          errCheck(err);
          doc = d;
          if (doc)
            db.collections.ascent.count({country_id: doc._id}, this);
          else this();
        },
        function (err, cnt) {
          errCheck(err);
          cnt = cnt || 0;
          if (cnt > 0) return this();
          okay = true;
          if (doc) {
            db.collections.ascent.remove({country_id: doc._id}, this.parallel());
            db.collections.crag.remove({country_id: doc._id}, this.parallel());
            db.collections.country.remove({_id: doc._id}, this.parallel());
          } else this();
        },
        function (err) {
          errCheck(err);
          if (okay)
            proceed();
          else {
            ++y;
            if (y === countries.length)
              return done();
            handle(countries[y]);
          }
        }
      );

      function proceed() {

        // Open list for crags:
        var crags = [
          /*
          {
            _id: String,
            key: String,
            name: String,
            city: String,
            country: String,
            bcnt: Number,
            rcnt: Number,
            bgrdu: String,
            bgrdl: String,
            rgrdu: String,
            rgrdl: String,
            lat: Number,
            lon: Number,
            country_id: String
          }
          */
        ];

        // Open list for ascents:
        var ascents = [
          /*
          {
            _id: String,
            key: String,
            name: String,
            type: String,
            sector: String,
            crag: String,
            city: String,
            country: String,
            grades: [String],
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
                var cs = [];
                var match;
                while ((match = crag_rx.exec(body))) {
                  var c = {
                    _id: new ObjectID(),
                    name: format(match[2]),
                    country: country.name,
                    country_id: country._id,
                    id: Number(match[1].trim()),
                    bcnt: 0,
                    rcnt: 0,
                    bgrdu: _.min(grades),
                    bgrdl: _.max(grades),
                    rgrdu: _.min(grades),
                    rgrdl: _.max(grades)
                  };
                  if (match[4] && match[4].trim() !== '')
                    c.city = format(match[4]);
                  var slug = _.slugify(c.name);
                  if (slug === '') continue;
                  c.key = [country.key, slug].join('/');
                  cs.push(c);
                }
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
            var map = {};
            _.each(crags, function (c) {
              var e = map[c.key];
              if (!e) map[c.key] = c;
              else { 
                e.city = e.city || c.city;
                e.lat = e.lat || c.lat;
                e.lon = e.lon || c.lon;
              }
            });
            crags = [];
            _.each(map, function (c) { crags.push(c); });
            crag_cnt += crags.length;
            log(clc.cyan('Found ') + clc.green(crags.length)
                + ' crags in ' + clc.underline(country.name) + '.');
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
              var _next = _.after(batch.length
                  * types.length
                  * _.size(rating_map), cb);
              _.each(batch, function (c) {
                _.each(types, function (t) {
                  _.each(rating_map, function (g, k) {
                    var type = t ? 'b' : 'r';
                    var fulltype = t ? 'boulders' : 'routes';
                    var form = {
                      __EVENTTARGET: undefined,
                      __EVENTARGUMENT: undefined,
                      __VIEWSTATE: '/wEPDwULLTExMDQ5NjY3OTcPZBYCAgQPZBYcAgEPZBYGAgUPEA8WBh4NRGF0YVRleHRGaWVsZAUIZnJhR3JhZGUeDkRhdGFWYWx1ZUZpZWxkBQJpZB4LXyFEYXRhQm91bmRnZBAVHAEzATQCNWECNWICNWMCNmEDNmErAjZiAzZiKwI2YwM2YysCN2EDN2ErAjdiAzdiKwI3YwM3YysCOGEDOGErAjhiAzhiKwI4YwM4YysCOWEDOWErAjliAzliKwI5YxUcAjEwAjExAjEyAjEzAjE0AjE1AjE2AjE3AjE4AjE5AjIwAjIxAjIyAjIzAjI0AjI1AjI2AjI3AjI4AjI5AjMwAjMxAjMyAjMzAjM0AjM1AjM2AjM3FCsDHGdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dkZAINDxAPFgIfAmdkEBWoAQEtB0FsYmFuaWEOQW1lcmljYW4gU2Ftb2EHQW5kb3JyYQZBbmdvbGEIQW5ndWlsbGEKQW50YXJjdGljYQlBcmdlbnRpbmEHQXJtZW5pYQVBcnViYQlBdXN0cmFsaWEHQXVzdHJpYQpBemVyYmFpamFuB0JhaGFtYXMKQmFuZ2xhZGVzaAhCYXJiYWRvcwdCZWxhcnVzB0JlbGdpdW0FQmVuaW4HQmVybXVkYQdCb2xpdmlhFEJvc25pYSAmIEhlcnplZ293aW5hCEJvdHN3YW5hDUJvdXZldCBJc2xhbmQGQnJhemlsCEJ1bGdhcmlhDEJ1cmtpbmEgRmFzbwdCdXJ1bmRpCENhbWJvZGlhCENhbWVyb29uBkNhbmFkYQpDYXBlIFZlcmRlDkNheW1hbiBJc2xhbmRzBUNoaWxlBUNoaW5hFUNvY29zIChLZWVsaW5nKSBJc2xlcwhDb2xvbWJpYQVDb25nbwpDb3N0YSBSaWNhB0Nyb2F0aWEEQ3ViYQZDeXBydXMOQ3plY2ggUmVwdWJsaWMHRGVubWFyawhEamlib3V0aRJEb21pbmljYW4gUmVwdWJsaWMKRWFzdCBUaW1vcgdFY3VhZG9yBUVneXB0C0VsIFNhbHZhZG9yB0VzdG9uaWEIRXRoaW9waWEbRmFsa2xhbmQgSXNsYW5kcyAoTWFsdmluYXMpDUZhcm9lIElzbGFuZHMERmlqaQdGaW5sYW5kBkZyYW5jZQ1GcmFuY2UsIE1ldHJvFUZyZW5jaCBTb3V0aGVybiBUZXJyLgVHYWJvbgZHYW1iaWEHR2VvcmdpYQdHZXJtYW55BUdoYW5hCUdpYnJhbHRhcgZHcmVlY2UJR3JlZW5sYW5kBEd1YW0JR3VhdGVtYWxhBUhhaXRpCEhvbmR1cmFzCUhvbmcgS29uZwdIdW5nYXJ5B0ljZWxhbmQFSW5kaWEJSW5kb25lc2lhBElyYW4HSXJlbGFuZAZJc3JhZWwFSXRhbHkFSmFwYW4GSm9yZGFuCkthemFraHN0YW4FS2VueWEIS2lyaWJhdGkXS29yZWEsIERlbSBQZW9wbGUncyBSZXASS29yZWEsIFJlcHVibGljIE9mCkt5cmd5enN0YW4ETGFvcwZMYXR2aWEHTGViYW5vbgdMaWJlcmlhDUxpZWNodGVuc3RlaW4JTGl0aHVhbmlhCkx1eGVtYm91cmcFTWFjYXUXTWFjZWRvbmlhIChSZXB1YmxpYyBvZikKTWFkYWdhc2NhcgZNYWxhd2kITWFsYXlzaWEETWFsaQVNYWx0YQpNYXJ0aW5pcXVlB01heW90dGUGTWV4aWNvBk1vbmFjbwhNb25nb2xpYQpNb250c2VycmF0B01vcm9jY28HTmFtaWJpYQVOZXBhbAtOZXRoZXJsYW5kcw1OZXcgQ2FsZWRvbmlhC05ldyBaZWFsYW5kB05pZ2VyaWEWTm9ydGhlcm4gTWFyaWFuYSBJc2xlcwZOb3J3YXkET21hbghQYWtpc3RhbgZQYW5hbWEEUGVydQtQaGlsaXBwaW5lcwhQaXRjYWlybgZQb2xhbmQIUG9ydHVnYWwLUHVlcnRvIFJpY28HUmV1bmlvbgdSb21hbmlhElJ1c3NpYW4gRmVkZXJhdGlvbhpTIEdlb3JnaWEgJiBTYW5kd2ljaCBJc2xlcxNTYWludCBLaXR0cyAmIE5ldmlzGlNhaW50IFZpbmNlbnQgJiBHcmVuYWRpbmVzBVNhbW9hClNhbiBNYXJpbm8MU2F1ZGkgQXJhYmlhE1NlcmJpYSAoWXVnb3NsYXZpYSkKU2V5Y2hlbGxlcwlTaW5nYXBvcmUVU2xvdmFraWEgKFNsb3ZhayBSZXApCFNsb3ZlbmlhD1NvbG9tb24gSXNsYW5kcwdTb21hbGlhDFNvdXRoIEFmcmljYQVTcGFpbglTcmkgTGFua2EFU3VkYW4cU3ZhbGJhcmQgJiBKYW4gTWF5ZW4gSXNsYW5kcwlTd2F6aWxhbmQGU3dlZGVuC1N3aXR6ZXJsYW5kBVN5cmlhBlRhaXdhbgpUYWppa2lzdGFuCFRoYWlsYW5kBlR1cmtleQZVZ2FuZGEHVWtyYWluZRRVbml0ZWQgQXJhYiBFbWlyYXRlcw5Vbml0ZWQgS2luZ2RvbQ1Vbml0ZWQgU3RhdGVzB1VydWd1YXkKVXpiZWtpc3RhbglWZW5lenVlbGEIVmlldCBOYW0WVmlyZ2luIElzbGVzIChCcml0aXNoKQVZZW1lbgpZdWdvc2xhdmlhCFppbWJhYndlFagBAANBTEIDQVNNA0FORANBR08DQUlBA0FUQQNBUkcDQVJNA0FCVwNBVVMDQVVUA0FaRQNCSFMDQkdEA0JSQgNCTFIDQkVMA0JFTgNCTVUDQk9MA0JJSANCV0EDQlZUA0JSQQNCR1IDQkZBA0JESQNLSE0DQ01SA0NBTgNDUFYDQ1lNA0NITANDSE4DQ0NLA0NPTANDT0cDQ1JJA0hSVgNDVUIDQ1lQA0NaRQNETksDREpJA0RPTQNUTVADRUNVA0VHWQNTTFYDRVNUA0VUSANGTEsDRlJPA0ZKSQNGSU4DRlJBA0ZYWANBVEYDR0FCA0dNQgNHRU8DREVVA0dIQQNHSUIDR1JDA0dSTANHVU0DR1RNA0hUSQNITkQDSEtHA0hVTgNJU0wDSU5EA0lETgNJUk4DSVJMA0lTUgNJVEEDSlBOA0pPUgNLQVoDS0VOA0tJUgNQUksDS09SA0tHWgNMQU8DTFZBA0xCTgNMQlIDTElFA0xUVQNMVVgDTUFDA01LRANNREcDTVdJA01ZUwNNTEkDTUxUA01UUQNNWVQDTUVYA01DTwNNTkcDTVNSA01BUgNOQU0DTlBMA05MRANOQ0wDTlpMA05HQQNNTlADTk9SA09NTgNQQUsDUEFOA1BFUgNQSEwDUENOA1BPTANQUlQDUFJJA1JFVQNST00DUlVTA1NHUwNLTkEDVkNUA1dTTQNTTVIDU0FVA1NSQgNTWUMDU0dQA1NWSwNTVk4DU0xCA1NPTQNaQUYDRVNQA0xLQQNTRE4DU0pNA1NXWgNTV0UDQ0hFA1NZUgNUV04DVEpLA1RIQQNUVVIDVUdBA1VLUgNBUkUDR0JSA1VTQQNVUlkDVVpCA1ZFTgNWTk0DVkdCA1lFTQNZVUcDWldFFCsDqAFnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dkZAIPDw8WAh4HVmlzaWJsZWdkFgYCBw8QZGQWAGQCCQ8QZGQWAWZkAgsPEGRkFgECAWQCAg9kFgYCAQ8PFgIeBFRleHQFCU15IENyYWdzOmRkAgMPDxYCHwQF+QY8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9VVNBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1Zb3NlbWl0ZSI+WW9zZW1pdGU8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9VVNBJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1CaXNob3AiPkJpc2hvcDwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1GUkEmQXNjZW50VHlwZT0wJkNyYWdOYW1lPUdvcmdlcytEdStUYXJuIj5Hb3JnZXMgRHUgVGFybjwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1HUkMmQXNjZW50VHlwZT0wJkNyYWdOYW1lPUthbHltbm9zIj5LYWx5bW5vczwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1VU0EmQXNjZW50VHlwZT0wJkNyYWdOYW1lPVJlZCtSb2NrcyI+UmVkIFJvY2tzPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUZSQSZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9QyVlOSVmY3NlIj5Dw6nDvHNlPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUhSViZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9Um92aW5qIj5Sb3Zpbmo8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9SFJWJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1NYXJqYW4iPk1hcmphbjwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1HUkMmQXNjZW50VHlwZT0wJkNyYWdOYW1lPU1vdXpha2kiPk1vdXpha2k8L2E+ZGQCBQ8PFgQfBAUMW0NsZWFyIExpc3RdHwNnZGQCAw9kFiYCAw8QZGQWAWZkAgUPEA8WBh8BBQJpZB8ABQhmcmFHcmFkZR8CZ2QQFR0BLQEzATQCNWECNWICNWMCNmEDNmErAjZiAzZiKwI2YwM2YysCN2EDN2ErAjdiAzdiKwI3YwM3YysCOGEDOGErAjhiAzhiKwI4YwM4YysCOWEDOWErAjliAzliKwI5YxUdATACMTACMTECMTICMTMCMTQCMTUCMTYCMTcCMTgCMTkCMjACMjECMjICMjMCMjQCMjUCMjYCMjcCMjgCMjkCMzACMzECMzICMzMCMzQCMzUCMzYCMzcUKwMdZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2cWAQISZAIHDxBkZBYBZmQCCQ8QZGQWAWZkAgsPEGRkFgFmZAINDxBkZBYBZmQCEw8QDxYCHwJnZBAVqAEBLQdBbGJhbmlhDkFtZXJpY2FuIFNhbW9hB0FuZG9ycmEGQW5nb2xhCEFuZ3VpbGxhCkFudGFyY3RpY2EJQXJnZW50aW5hB0FybWVuaWEFQXJ1YmEJQXVzdHJhbGlhB0F1c3RyaWEKQXplcmJhaWphbgdCYWhhbWFzCkJhbmdsYWRlc2gIQmFyYmFkb3MHQmVsYXJ1cwdCZWxnaXVtBUJlbmluB0Jlcm11ZGEHQm9saXZpYRRCb3NuaWEgJiBIZXJ6ZWdvd2luYQhCb3Rzd2FuYQ1Cb3V2ZXQgSXNsYW5kBkJyYXppbAhCdWxnYXJpYQxCdXJraW5hIEZhc28HQnVydW5kaQhDYW1ib2RpYQhDYW1lcm9vbgZDYW5hZGEKQ2FwZSBWZXJkZQ5DYXltYW4gSXNsYW5kcwVDaGlsZQVDaGluYRVDb2NvcyAoS2VlbGluZykgSXNsZXMIQ29sb21iaWEFQ29uZ28KQ29zdGEgUmljYQdDcm9hdGlhBEN1YmEGQ3lwcnVzDkN6ZWNoIFJlcHVibGljB0Rlbm1hcmsIRGppYm91dGkSRG9taW5pY2FuIFJlcHVibGljCkVhc3QgVGltb3IHRWN1YWRvcgVFZ3lwdAtFbCBTYWx2YWRvcgdFc3RvbmlhCEV0aGlvcGlhG0ZhbGtsYW5kIElzbGFuZHMgKE1hbHZpbmFzKQ1GYXJvZSBJc2xhbmRzBEZpamkHRmlubGFuZAZGcmFuY2UNRnJhbmNlLCBNZXRybxVGcmVuY2ggU291dGhlcm4gVGVyci4FR2Fib24GR2FtYmlhB0dlb3JnaWEHR2VybWFueQVHaGFuYQlHaWJyYWx0YXIGR3JlZWNlCUdyZWVubGFuZARHdWFtCUd1YXRlbWFsYQVIYWl0aQhIb25kdXJhcwlIb25nIEtvbmcHSHVuZ2FyeQdJY2VsYW5kBUluZGlhCUluZG9uZXNpYQRJcmFuB0lyZWxhbmQGSXNyYWVsBUl0YWx5BUphcGFuBkpvcmRhbgpLYXpha2hzdGFuBUtlbnlhCEtpcmliYXRpF0tvcmVhLCBEZW0gUGVvcGxlJ3MgUmVwEktvcmVhLCBSZXB1YmxpYyBPZgpLeXJneXpzdGFuBExhb3MGTGF0dmlhB0xlYmFub24HTGliZXJpYQ1MaWVjaHRlbnN0ZWluCUxpdGh1YW5pYQpMdXhlbWJvdXJnBU1hY2F1F01hY2Vkb25pYSAoUmVwdWJsaWMgb2YpCk1hZGFnYXNjYXIGTWFsYXdpCE1hbGF5c2lhBE1hbGkFTWFsdGEKTWFydGluaXF1ZQdNYXlvdHRlBk1leGljbwZNb25hY28ITW9uZ29saWEKTW9udHNlcnJhdAdNb3JvY2NvB05hbWliaWEFTmVwYWwLTmV0aGVybGFuZHMNTmV3IENhbGVkb25pYQtOZXcgWmVhbGFuZAdOaWdlcmlhFk5vcnRoZXJuIE1hcmlhbmEgSXNsZXMGTm9yd2F5BE9tYW4IUGFraXN0YW4GUGFuYW1hBFBlcnULUGhpbGlwcGluZXMIUGl0Y2Fpcm4GUG9sYW5kCFBvcnR1Z2FsC1B1ZXJ0byBSaWNvB1JldW5pb24HUm9tYW5pYRJSdXNzaWFuIEZlZGVyYXRpb24aUyBHZW9yZ2lhICYgU2FuZHdpY2ggSXNsZXMTU2FpbnQgS2l0dHMgJiBOZXZpcxpTYWludCBWaW5jZW50ICYgR3JlbmFkaW5lcwVTYW1vYQpTYW4gTWFyaW5vDFNhdWRpIEFyYWJpYRNTZXJiaWEgKFl1Z29zbGF2aWEpClNleWNoZWxsZXMJU2luZ2Fwb3JlFVNsb3Zha2lhIChTbG92YWsgUmVwKQhTbG92ZW5pYQ9Tb2xvbW9uIElzbGFuZHMHU29tYWxpYQxTb3V0aCBBZnJpY2EFU3BhaW4JU3JpIExhbmthBVN1ZGFuHFN2YWxiYXJkICYgSmFuIE1heWVuIElzbGFuZHMJU3dhemlsYW5kBlN3ZWRlbgtTd2l0emVybGFuZAVTeXJpYQZUYWl3YW4KVGFqaWtpc3RhbghUaGFpbGFuZAZUdXJrZXkGVWdhbmRhB1VrcmFpbmUUVW5pdGVkIEFyYWIgRW1pcmF0ZXMOVW5pdGVkIEtpbmdkb20NVW5pdGVkIFN0YXRlcwdVcnVndWF5ClV6YmVraXN0YW4JVmVuZXp1ZWxhCFZpZXQgTmFtFlZpcmdpbiBJc2xlcyAoQnJpdGlzaCkFWWVtZW4KWXVnb3NsYXZpYQhaaW1iYWJ3ZRWoAQADQUxCA0FTTQNBTkQDQUdPA0FJQQNBVEEDQVJHA0FSTQNBQlcDQVVTA0FVVANBWkUDQkhTA0JHRANCUkIDQkxSA0JFTANCRU4DQk1VA0JPTANCSUgDQldBA0JWVANCUkEDQkdSA0JGQQNCREkDS0hNA0NNUgNDQU4DQ1BWA0NZTQNDSEwDQ0hOA0NDSwNDT0wDQ09HA0NSSQNIUlYDQ1VCA0NZUANDWkUDRE5LA0RKSQNET00DVE1QA0VDVQNFR1kDU0xWA0VTVANFVEgDRkxLA0ZSTwNGSkkDRklOA0ZSQQNGWFgDQVRGA0dBQgNHTUIDR0VPA0RFVQNHSEEDR0lCA0dSQwNHUkwDR1VNA0dUTQNIVEkDSE5EA0hLRwNIVU4DSVNMA0lORANJRE4DSVJOA0lSTANJU1IDSVRBA0pQTgNKT1IDS0FaA0tFTgNLSVIDUFJLA0tPUgNLR1oDTEFPA0xWQQNMQk4DTEJSA0xJRQNMVFUDTFVYA01BQwNNS0QDTURHA01XSQNNWVMDTUxJA01MVANNVFEDTVlUA01FWANNQ08DTU5HA01TUgNNQVIDTkFNA05QTANOTEQDTkNMA05aTANOR0EDTU5QA05PUgNPTU4DUEFLA1BBTgNQRVIDUEhMA1BDTgNQT0wDUFJUA1BSSQNSRVUDUk9NA1JVUwNTR1MDS05BA1ZDVANXU00DU01SA1NBVQNTUkIDU1lDA1NHUANTVksDU1ZOA1NMQgNTT00DWkFGA0VTUANMS0EDU0ROA1NKTQNTV1oDU1dFA0NIRQNTWVIDVFdOA1RKSwNUSEEDVFVSA1VHQQNVS1IDQVJFA0dCUgNVU0EDVVJZA1VaQgNWRU4DVk5NA1ZHQgNZRU0DWVVHA1pXRRQrA6gBZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnFgFmZAIVDxBkZBYBZmQCFw8QZGQWAWZkAhsPEGRkFgFmZAIdDxAPFgYfAQUCaWQfAAUIZnJhR3JhZGUfAmdkEBUdAS0BMwE0AjVhAjViAjVjAjZhAzZhKwI2YgM2YisCNmMDNmMrAjdhAzdhKwI3YgM3YisCN2MDN2MrAjhhAzhhKwI4YgM4YisCOGMDOGMrAjlhAzlhKwI5YgM5YisCOWMVHQEwAjEwAjExAjEyAjEzAjE0AjE1AjE2AjE3AjE4AjE5AjIwAjIxAjIyAjIzAjI0AjI1AjI2AjI3AjI4AjI5AjMwAjMxAjMyAjMzAjM0AjM1AjM2AjM3FCsDHWdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnFgECEmQCHw8QZGQWAWZkAiEPEGRkFgFmZAIjDxBkZBYBZmQCJQ8QZGQWAWZkAi8PEGRkFgFmZAIxDxBkZBYBZmQCMw8QZGQWAWZkAjUPEGRkFgFmZAIED2QWAmYPZBYCZg8PFgIfA2hkZAIFDw8WBB8EBQ9TZWFyY2ggaGl0czogMTcfA2hkZAIHDw8WBh4LTmF2aWdhdGVVcmwFHlRpY2tsaXN0LmFzcHg/Q3JhZ05hbWU9QmVyZG9yZh8EBRJQcmludCBhcyBUaWNrIExpc3QfA2dkZAIIDw8WBh8EBQ5MYXRlc3QgQXNjZW50cx8DZx8FBYABU2VhcmNoLmFzcHg/U2VhcmNoVHlwZT1BU0NFTlRTJkhpZGVTZWFyY2hGb3JtPTEmQ3JhZ05hbWU9QmVyZG9yZiZBc2NlbnRTb3J0T2JqZWN0PXMuZGF0ZSZBc2NlbnRTb3J0T2JqZWN0T3JkZXI9REVTQyZBc2NlbnRUeXBlPTFkZAIJDxYCHwNnZAIKDzwrAAsCAA8WCB4IRGF0YUtleXMWAB4LXyFJdGVtQ291bnQCER4JUGFnZUNvdW50AgEeFV8hRGF0YVNvdXJjZUl0ZW1Db3VudAIRZAoUKwALPCsABAEAFggeCkhlYWRlclRleHQFCUdyYWRlTmFtZR4JRGF0YUZpZWxkBQlHcmFkZU5hbWUeDlNvcnRFeHByZXNzaW9uBQlHcmFkZU5hbWUeCFJlYWRPbmx5aDwrAAQBABYIHwoFC0FzY2VudENvdW50HwsFC0FzY2VudENvdW50HwwFC0FzY2VudENvdW50Hw1oPCsABAEAFggfCgUEbmFtZR8LBQRuYW1lHwwFBG5hbWUfDWg8KwAEAQAWCB8KBQRjcmFnHwsFBGNyYWcfDAUEY3JhZx8NaDwrAAQBABYIHwoFCmNyYWdTZWN0b3IfCwUKY3JhZ1NlY3Rvch8MBQpjcmFnU2VjdG9yHw1oPCsABAEAFggfCgUKQXNjZW50VHlwZR8LBQpBc2NlbnRUeXBlHwwFCkFzY2VudFR5cGUfDWg8KwAEAQAWCB8KBQdHcmFkZUlkHwsFB0dyYWRlSWQfDAUHR3JhZGVJZB8NaDwrAAQBABYIHwoFCUF2Z1JhdGluZx8LBQlBdmdSYXRpbmcfDAUJQXZnUmF0aW5nHw1oPCsABAEAFggfCgUDRk9THwsFA0ZPUx8MBQNGT1MfDWg8KwAEAQAWCB8KBQtBc2NlbnRJbmRleB8LBQtBc2NlbnRJbmRleB8MBQtBc2NlbnRJbmRleB8NaDwrAAQBABYIHwoFC0NvdW50cnlDb2RlHwsFC0NvdW50cnlDb2RlHwwF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DxYCHwQFDGNob2NvIHByaW5jZWRkAgMPDxYCHwQFB0JlcmRvcmZkZAIEDw8WAh8EBQYmbmJzcDtkZAIFDw8WAh8EBQExZGQCBg8PFgIfBAUCMThkZAIHDw8WAh8EBQEyZGQCCA8PFgIfBAUBMWRkAgkPDxYCHwQFATNkZAIKDw8WAh8EBQNMVVhkZAIRD2QWFmYPDxYCHwQFAjVDZGQCAQ8PFgIfBAUBMWRkAgIPDxYCHwQFDHNhY2hzc2Vucmlzc2RkAgMPDxYCHwQFB0JlcmRvcmZkZAIEDw8WAh8EBQYmbmJzcDtkZAIFDw8WAh8EBQExZGQCBg8PFgIfBAUCMTRkZAIHDw8WAh8EBQEyZGQCCA8PFgIfBAUBMWRkAgkPDxYCHwQFATNkZAIKDw8WAh8EBQNMVVhkZAIODxAPFgYfAQUFc2hvcnQfAAUFd2hvbGUfAmdkEBXMAQ1BbGwgQ291bnRyaWVzB0FsYmFuaWEHQWxnZXJpYQ5BbWVyaWNhbiBTYW1vYQdBbmRvcnJhBkFuZ29sYQhBbmd1aWxsYQpBbnRhcmN0aWNhEUFudGlndWEgJiBCYXJidWRhCUFyZ2VudGluYQdBcm1lbmlhBUFydWJhCUF1c3RyYWxpYQdBdXN0cmlhCkF6ZXJiYWlqYW4HQmFoYW1hcwdCYWhyYWluCkJhbmdsYWRlc2gIQmFyYmFkb3MHQmVsYXJ1cwdCZWxnaXVtBkJlbGl6ZQVCZW5pbgdCZXJtdWRhB0JvbGl2aWEUQm9zbmlhICYgSGVyemVnb3dpbmEIQm90c3dhbmEGQnJhemlsGkJyaXRpc2ggSW5kaWFuIE9jZWFuIFRlcnIuEUJydW5laSBEYXJ1c3NhbGFtCEJ1bGdhcmlhB0J1cnVuZGkGQ2FuYWRhDkNheW1hbiBJc2xhbmRzBENoYWQFQ2hpbGUFQ2hpbmEQQ2hyaXN0bWFzIElzbGFuZBVDb2NvcyAoS2VlbGluZykgSXNsZXMIQ29sb21iaWEHQ29tb3JvcwVDb25nbxlDb25nbywgVGhlIERlbW9jcmF0aWMgUmVwCkNvc3RhIFJpY2EHQ3JvYXRpYQRDdWJhBkN5cHJ1cw5DemVjaCBSZXB1YmxpYwdEZW5tYXJrCERqaWJvdXRpEkRvbWluaWNhbiBSZXB1YmxpYwdFY3VhZG9yBUVneXB0C0VsIFNhbHZhZG9yEUVxdWF0b3JpYWwgR3VpbmVhB0VyaXRyZWEHRXN0b25pYQhFdGhpb3BpYRtGYWxrbGFuZCBJc2xhbmRzIChNYWx2aW5hcykNRmFyb2UgSXNsYW5kcwRGaWppB0ZpbmxhbmQGRnJhbmNlDUZyYW5jZSwgTWV0cm8QRnJlbmNoIFBvbHluZXNpYRVGcmVuY2ggU291dGhlcm4gVGVyci4FR2Fib24HR2VvcmdpYQdHZXJtYW55BUdoYW5hCUdpYnJhbHRhcgZHcmVlY2UJR3JlZW5sYW5kBEd1YW0JR3VhdGVtYWxhDUd1aW5lYS1CaXNzYXUGR3V5YW5hBUhhaXRpGUhlYXJkIEFuZCBNYyBEb25hbGQgSXNsZXMISG9uZHVyYXMJSG9uZyBLb25nB0h1bmdhcnkHSWNlbGFuZAVJbmRpYQlJbmRvbmVzaWEESXJhbgRJcmFxB0lyZWxhbmQGSXNyYWVsBUl0YWx5G0l2b3J5IENvYXN0IChDb3RlIEQnSXZvaXJlKQdKYW1haWNhBUphcGFuBkpvcmRhbgpLYXpha2hzdGFuBUtlbnlhCEtpcmliYXRpEktvcmVhLCBSZXB1YmxpYyBPZgZLdXdhaXQKS3lyZ3l6c3RhbgRMYW9zBkxhdHZpYQdMZWJhbm9uB0xpYmVyaWEFTGlieWENTGllY2h0ZW5zdGVpbglMaXRodWFuaWEKTHV4ZW1ib3VyZwVNYWNhdRdNYWNlZG9uaWEgKFJlcHVibGljIG9mKQpNYWRhZ2FzY2FyBk1hbGF3aQhNYWxheXNpYQhNYWxkaXZlcwRNYWxpBU1hbHRhEE1hcnNoYWxsIElzbGFuZHMJTWF1cml0aXVzB01heW90dGUGTWV4aWNvFk1pY3JvbmVzaWEsIEZlZCBTdGF0ZXMMTW9sZG92YSwgUmVwCE1vbmdvbGlhCk1vbnRzZXJyYXQHTW9yb2NjbwpNb3phbWJpcXVlB05hbWliaWEFTmF1cnUFTmVwYWwLTmV0aGVybGFuZHMNTmV3IENhbGVkb25pYQtOZXcgWmVhbGFuZAlOaWNhcmFndWEFTmlnZXIHTmlnZXJpYQROaXVlBE5vbmUETm9uZQ5Ob3Jmb2xrIElzbGFuZAZOb3J3YXkET21hbghQYWtpc3RhbgVQYWxhdQZQYW5hbWEQUGFwdWEgTmV3IEd1aW5lYQRQZXJ1C1BoaWxpcHBpbmVzBlBvbGFuZAhQb3J0dWdhbAtQdWVydG8gUmljbwVRYXRhcgdSZXVuaW9uB1JvbWFuaWESUnVzc2lhbiBGZWRlcmF0aW9uBlJ3YW5kYRNTYWludCBLaXR0cyAmIE5ldmlzBVNhbW9hClNhbiBNYXJpbm8TU2FvIFRvbWUgJiBQcmluY2lwZQxTYXVkaSBBcmFiaWEHU2VuZWdhbBNTZXJiaWEgKFl1Z29zbGF2aWEpDFNpZXJyYSBMZW9uYQlTaW5nYXBvcmUVU2xvdmFraWEgKFNsb3ZhayBSZXApCFNsb3ZlbmlhD1NvbG9tb24gSXNsYW5kcwdTb21hbGlhDFNvdXRoIEFmcmljYQVTcGFpbglTcmkgTGFua2EKU3QuIEhlbGVuYQVTdWRhbglTd2F6aWxhbmQGU3dlZGVuC1N3aXR6ZXJsYW5kBVN5cmlhBlRhaXdhbgpUYWppa2lzdGFuCFRhbnphbmlhCFRoYWlsYW5kBFRvZ28FVG9uZ2EHVHVuaXNpYQZUdXJrZXkGVHV2YWx1BlVnYW5kYQdVa3JhaW5lFFVuaXRlZCBBcmFiIEVtaXJhdGVzDlVuaXRlZCBLaW5nZG9tDVVuaXRlZCBTdGF0ZXMHVXJ1Z3VheRdVUyBNaW5vciBPdXRseWluZyBJc2xlcwpVemJla2lzdGFuB1ZhbnVhdHUJVmVuZXp1ZWxhCFZpZXQgTmFtFlZpcmdpbiBJc2xlcyAoQnJpdGlzaCkXV2FsbGlzICYgRnV0dW5hIElzbGFuZHMOV2VzdGVybiBTYWhhcmEFWWVtZW4KWXVnb3NsYXZpYQZaYW1iaWEIWmltYmFid2UVzAEAA0FMQgNEWkEDQVNNA0FORANBR08DQUlBA0FUQQNBVEcDQVJHA0FSTQNBQlcDQVVTA0FVVANBWkUDQkhTA0JIUgNCR0QDQlJCA0JMUgNCRUwDQkxaA0JFTgNCTVUDQk9MA0JJSANCV0EDQlJBA0lPVANCUk4DQkdSA0JESQNDQU4DQ1lNA1RDRANDSEwDQ0hOA0NYUgNDQ0sDQ09MA0NPTQNDT0cDQ09EA0NSSQNIUlYDQ1VCA0NZUANDWkUDRE5LA0RKSQNET00DRUNVA0VHWQNTTFYDR05RA0VSSQNFU1QDRVRIA0ZMSwNGUk8DRkpJA0ZJTgNGUkEDRlhYA1BZRgNBVEYDR0FCA0dFTwNERVUDR0hBA0dJQgNHUkMDR1JMA0dVTQNHVE0DR05CA0dVWQNIVEkDSE1EA0hORANIS0cDSFVOA0lTTANJTkQDSUROA0lSTgNJUlEDSVJMA0lTUgNJVEEDQ0lWA0pBTQNKUE4DSk9SA0tBWgNLRU4DS0lSA0tPUgNLV1QDS0daA0xBTwNMVkEDTEJOA0xCUgNMQlkDTElFA0xUVQNMVVgDTUFDA01LRANNREcDTVdJA01ZUwNNRFYDTUxJA01MVANNSEwDTVVTA01ZVANNRVgDRlNNA01EQQNNTkcDTVNSA01BUgNNT1oDTkFNA05SVQNOUEwDTkxEA05DTANOWkwDTklDA05FUgNOR0EDTklVAARub25lA05GSwNOT1IDT01OA1BBSwNQTFcDUEFOA1BORwNQRVIDUEhMA1BPTANQUlQDUFJJA1FBVANSRVUDUk9NA1JVUwNSV0EDS05BA1dTTQNTTVIDU1RQA1NBVQNTRU4DU1JCA1NMRQNTR1ADU1ZLA1NWTgNTTEIDU09NA1pBRgNFU1ADTEtBA1NITgNTRE4DU1daA1NXRQNDSEUDU1lSA1RXTgNUSksDVFpBA1RIQQNUR08DVE9OA1RVTgNUVVIDVFVWA1VHQQNVS1IDQVJFA0dCUgNVU0EDVVJZA1VNSQNVWkIDVlVUA1ZFTgNWTk0DVkdCA1dMRgNFU0gDWUVNA1lVRwNaTUIDWldFFCsDzAFnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dkZAISDw8WAh8EBY0MPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPURFVSZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9RnJhbmtlbmp1cmEiPkZyYW5rZW5qdXJhPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUdSQyZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9S2FseW1ub3MiPkthbHltbm9zPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUVTUCZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9Um9kZWxsYXIiPlJvZGVsbGFyPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVVTQSZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9UmVkK3JpdmVyK2dvcmdlIj5SZWQgcml2ZXIgZ29yZ2U8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RVNQJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1NYXJnYWxlZiI+TWFyZ2FsZWY8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RVNQJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1TaXVyYW5hIj5TaXVyYW5hPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVRIQSZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9UmFpbGF5Ij5SYWlsYXk8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RlJBJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1DJWU5JWZjc2UiPkPDqcO8c2U8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9SVRBJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1BcmNvIj5BcmNvPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVRVUiZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9R2V5aWsrYmF5aXJpIj5HZXlpayBiYXlpcmk8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RlJBJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1Hb3JnZXMrZHUrdGFybiI+R29yZ2VzIGR1IHRhcm48L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RVNQJkFzY2VudFR5cGU9MCZDcmFnTmFtZT1FbCtjaG9ycm8iPkVsIGNob3JybzwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1TVk4mQXNjZW50VHlwZT0wJkNyYWdOYW1lPU9zcCUyZm1pc2phK3BlYyI+T3NwL21pc2phIHBlYzwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1VU0EmQXNjZW50VHlwZT0wJkNyYWdOYW1lPU5ldytyaXZlcitnb3JnZSI+TmV3IHJpdmVyIGdvcmdlPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUFVUyZBc2NlbnRUeXBlPTAmQ3JhZ05hbWU9Qmx1ZSttb3VudGFpbnMiPkJsdWUgbW91bnRhaW5zPC9hPmRkAhMPDxYCHwQFigw8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9RlJBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1Gb250YWluZWJsZWF1Ij5Gb250YWluZWJsZWF1PC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVVTQSZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9QmlzaG9wIj5CaXNob3A8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9VVNBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1IdWVjbyt0YW5rcyI+SHVlY28gdGFua3M8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9Q0hFJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1NYWdpYyt3b29kIj5NYWdpYyB3b29kPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUVTUCZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9QWxiYXJyYWMlZWRuIj5BbGJhcnJhY8OtbjwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1DSEUmQXNjZW50VHlwZT0xJkNyYWdOYW1lPUNoaXJvbmljbyI+Q2hpcm9uaWNvPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUNBTiZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9U3F1YW1pc2giPlNxdWFtaXNoPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVNXRSZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9S2p1Z2VrdWxsIj5LanVnZWt1bGw8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9WkFGJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1Sb2NrbGFuZHMiPlJvY2tsYW5kczwvYT4sIDxhIGhyZWY9IlNlYXJjaC5hc3B4P01vZGU9U0lNUExFJkNyYWdDb3VudHJ5Q29kZT1HQlImQXNjZW50VHlwZT0xJkNyYWdOYW1lPVBlYWsrZGlzdHJpY3QiPlBlYWsgZGlzdHJpY3Q8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9QlJBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1Db2NhbHppbmhvIj5Db2NhbHppbmhvPC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPVVTQSZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9Sm9lJ3MrdmFsbGV5Ij5Kb2UncyB2YWxsZXk8L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9VVNBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1MaXR0bGUrcm9jaytjaXR5Ij5MaXR0bGUgcm9jayBjaXR5PC9hPiwgPGEgaHJlZj0iU2VhcmNoLmFzcHg/TW9kZT1TSU1QTEUmQ3JhZ0NvdW50cnlDb2RlPUNIRSZBc2NlbnRUeXBlPTEmQ3JhZ05hbWU9Q3Jlc2NpYW5vIj5DcmVzY2lhbm88L2E+LCA8YSBocmVmPSJTZWFyY2guYXNweD9Nb2RlPVNJTVBMRSZDcmFnQ291bnRyeUNvZGU9VVNBJkFzY2VudFR5cGU9MSZDcmFnTmFtZT1IcCs0MCI+SHAgNDA8L2E+ZGQCFg8PFgIfA2hkFgJmDw8WAh8DaGRkAhcPPCsADQBkGAIFHl9fQ29udHJvbHNSZXF1aXJlUG9zdEJhY2tLZXlfXxYdBRRDaGVja0JveExpc3RHcmFkZXMkMAUUQ2hlY2tCb3hMaXN0R3JhZGVzJDEFFENoZWNrQm94TGlzdEdyYWRlcyQyBRRDaGVja0JveExpc3RHcmFkZXMkMwUUQ2hlY2tCb3hMaXN0R3JhZGVzJDQFFENoZWNrQm94TGlzdEdyYWRlcyQ1BRRDaGVja0JveExpc3RHcmFkZXMkNgUUQ2hlY2tCb3hMaXN0R3JhZGVzJDcFFENoZWNrQm94TGlzdEdyYWRlcyQ4BRRDaGVja0JveExpc3RHcmFkZXMkOQUVQ2hlY2tCb3hMaXN0R3JhZGVzJDEwBRVDaGVja0JveExpc3RHcmFkZXMkMTEFFUNoZWNrQm94TGlzdEdyYWRlcyQxMgUVQ2hlY2tCb3hMaXN0R3JhZGVzJDEzBRVDaGVja0JveExpc3RHcmFkZXMkMTQFFUNoZWNrQm94TGlzdEdyYWRlcyQxNQUVQ2hlY2tCb3hMaXN0R3JhZGVzJDE2BRVDaGVja0JveExpc3RHcmFkZXMkMTcFFUNoZWNrQm94TGlzdEdyYWRlcyQxOAUVQ2hlY2tCb3hMaXN0R3JhZGVzJDE5BRVDaGVja0JveExpc3RHcmFkZXMkMjAFFUNoZWNrQm94TGlzdEdyYWRlcyQyMQUVQ2hlY2tCb3hMaXN0R3JhZGVzJDIyBRVDaGVja0JveExpc3RHcmFkZXMkMjMFFUNoZWNrQm94TGlzdEdyYWRlcyQyNAUVQ2hlY2tCb3hMaXN0R3JhZGVzJDI1BRVDaGVja0JveExpc3RHcmFkZXMkMjYFFUNoZWNrQm94TGlzdEdyYWRlcyQyNwUVQ2hlY2tCb3hMaXN0R3JhZGVzJDI3BQ1HcmlkVmlld0RlYnVnD2dk/UcTeUOAmlFrdGtnAid80PDVD9I=',
                      __EVENTVALIDATION: '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',
                      ListboxRorBSimple: t,
                      TextboxAscentCragSimple: c.name,
                      ListBoxAscentCountry: country.key.toUpperCase(),
                      ButtonSimple: 'Search',
                      TextboxAscentSector: undefined
                    };
                    form['CheckBoxListGrades$' + g] = 'on';
                    request.post({
                      uri: 'http://www.8a.nu/scorecard/Search.aspx',
                      qs: {CountryCode: 'GLOBAL'},
                      form: form,
                      headers: headers,
                      encoding: 'binary',
                    }, function (err, res, body) {
                      errCheck(err);
                      body = iconv.convert(new Buffer(body, 'binary')).toString();
                      var as = [];
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
                          country: country.name,
                          crag_id: c._id,
                          country_id: country._id,
                        };
                        if (m[4] && m[4].trim() !== '')
                          a.sector = format(m[4]);
                        var slug1 = _.slugify(a.crag);
                        var slug2 = _.slugify(a.name);
                        if (slug1 === '' || slug2 === '') continue;
                        a.key = [country.key, slug1, fulltype, slug2].join('/');
                        as.push(a);
                      }
                      if (as.length > 0) {
                        ascents.push(as);
                        log(clc.cyan('Found ') + clc.green(as.length)
                            + ' ' + k + ' ' + fulltype
                            + ' in ' + clc.underline(c.name) + '.');
                      }
                      _next();
                    });
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
            var map = {};
            _.each(ascents, function (a) {
              var crag = _.find(crags, function (c) {
                return a.crag_id.toString() === c._id.toString(); 
              });
              var grade = a.grade;
              delete a.grade;
              var tu = a.type + 'grdu';
              var tl = a.type + 'grdl';
              var gnum = rating_map[grade];
              if (gnum) {
                // check crag grade bounds
                if (gnum > rating_map[crag[tu]])
                  crag[tu] = grade;
                if (gnum < rating_map[crag[tl]])
                  crag[tl] = grade;
                // check country grade bounds
                if (rating_map[crag[tu]] > rating_map[country[tu]])
                  country[tu] = crag[tu];
                if (rating_map[crag[tl]] < rating_map[country[tl]])
                  country[tl] = crag[tl];
              }
              // check existing
              var e = map[a.key];
              if (!e) {
                crag[a.type + 'cnt'] += 1;
                country[a.type + 'cnt'] += 1;
                a.grades = [grade];
                map[a.key] = a;
              } else {
                e.sector = e.sector || a.sector;
                if (rating_map[grade] && !_.contains(e.grades, grade))
                  e.grades.push(grade);
              }
            });
            ascents = [];
            _.each(map, function (a) { ascents.push(a); });
            ascent_cnt += ascents.length;
            this();
          },

          // Save ascents.
          function (err) {
            errCheck(err);
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
      }
    })(countries[y]);
  },

  // Done.
  function (err) {
    errCheck(err);
    log(clc.blackBright('\nSuccessfully scraped 8a.nu:'));
    log(clc.green(countries.length) + ' countries, '
        + clc.green(crag_cnt) + ' crags, and '
        + clc.green(ascent_cnt) + ' ascents.\n');
    process.exit(0);
  }
);
