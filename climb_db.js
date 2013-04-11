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
      index: {key: 1},
      unique: {key: true}
    },
    crag: {
      index: {key: 1, type: 1, country_id: 1},
      unique: {key: true}
    },
    ascent: {
      index: {key: 1, type: 1, country_id: 1, crag_id: 1},
      unique: {key: true}
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
        var parallel = this.parallel;
        _.each(cols, function (col) {
          var index = collections[col.collectionName].index;
          var unique = collections[col.collectionName].unique[index] || false;
          if (index)
            col.ensureIndex(index, {unique: unique}, parallel());
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
    bccnt: 0,
    rccnt: 0,
    bcnt: 0,
    rcnt: 0,
    bgrdu: null,
    bgrdl: null,
    rgrdu: null,
    rgrdl: null,
    lat: null,
    lon: null
  });
  db.createDoc(self.collections.country, props, cb);
}

ClimbDb.prototype.createCrag = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['key', 'name', 'country',
                          'country_key', 'country_id']))
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
  if (!db.validate(props, ['key', 'name', 'grades', 'type', 'crag',
                          'country', 'country_key', 'country_id', 'crag_id']))
    return cb ? cb(new Error('Invalid ascent')) : false;
  _.defaults(props, {
    sector: null
  });
  db.createDoc(self.collections.ascent, props, cb);
}
