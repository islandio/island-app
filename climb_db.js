// Functionality for handling boulders and routes.

/**
* Module dependencies.
*/
var db = require('./db');
var request = require('request');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');

/*
 * Create a db wrapper.
 */
var ClimbDb = exports.ClimbDb = function (dB, options, cb) {
  var self = this;
  self.dB = dB;
  self.app = options.app;
  self.collections = {};

  var collections = {
    country: {
      indexes: [{key: 1}],
      uniques: [true]
    },
    crag: {
      indexes: [{key: 1}, {type: 1}, {country_id: 1}],
      uniques: [true, false, false]
    },
    ascent: {
      indexes: [{key: 1}, {type: 1}, {country_id: 1}, {crag_id: 1}],
      uniques: [true, false, false, false]
    },
  };

  Step(
    function () {
      var group = this.group();
      _.each(collections, function (k, name) {
        dB.collection(name, group());
      });
    },
    function (err, cols) {
      if (err) return this(err);
      _.each(cols, function (col) {
        self.collections[col.collectionName] = col;
      });
      if (options.ensureIndexes) {
        var next = _.after(cols.length, this);
        _.each(cols, function (col) {
          var indexes = collections[col.collectionName].indexes;
          var uniques = collections[col.collectionName].uniques;
          var _next = _.after(indexes.length, next);
          _.each(indexes, function (index, i) {
            col.dropIndexes(function () {
              col.ensureIndex(index, {unique: uniques[i]}, _next);
            });
          });
        });
      } else this();
    },
    function (err) {
      cb(err, self);
    }
  );
}

ClimbDb.prototype.createCountry = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['key', 'name']))
    return cb ? cb(new Error('Invalid country')) : false;
  _.defaults(props, {
    bcnt: 0,
    rcnt: 0,
    bgrdu: null,
    bgrdl: null,
    rgrdu: null,
    rgrdl: null
  });
  db.createDoc(self.collections.country, props, cb);
}

ClimbDb.prototype.createCrag = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['key', 'name', 'country', 'country_id']))
    return cb ? cb(new Error('Invalid crag')) : false;
  _.defaults(props, {
    city: null,
    bcnt: 0,
    rcnt: 0,
    bgrdu: null,
    bgrdl: null,
    rgrdu: null,
    rgrdl: null,
    lat: null,
    lon: null
  });
  db.createDoc(self.collections.crag, props, cb);
}

ClimbDb.prototype.createAscent = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['key', 'name', 'type', 'crag', 'grades',
                          'country', 'country_id', 'crag_id']))
    return cb ? cb(new Error('Invalid ascent')) : false;
  _.defaults(props, {
    sector: null
  });
  db.createDoc(self.collections.ascent, props, cb);
}
