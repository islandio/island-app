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
    country: { index: { key: 1 } },
    crag: { index: { key: 1, country_id: 1 } },
    ascent: { index: { key: 1, type: 1, country_id: 1, crag_id: 1 } },
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
          if (index)
            col.ensureIndex(index, parallel());
        });
      } else this();
    },
    function (err) {
      cb(err, self);
    }
  );
}

ClimbDb.prototype.createCounty = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['code', 'name']))
    return cb ? cb(new Error('Invalid country')) : false;
  props.key = props.code;
  delete props.code;
  _.defaults(props, {
    bcnt: 0,
    rcnt: 0,
    bgrd: 0,
    rgrd: 0,
    lat: null,
    lon: null,
  });
  db.createDoc(self.collections.country, props, cb);
}

ClimbDb.prototype.createCrag = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['name', 'country', 'country_code', 'country_id']))
    return cb ? cb(new Error('Invalid crag')) : false;
  props.key = [props.country_code, _.slugify(props.crag)].join('/');
  _.defaults(props, {
    city: null,
    bcnt: 0,
    rcnt: 0,
    bgrd: 0,
    rgrd: 0,
    lat: null,
    lon: null,
  });
  db.createDoc(self.collections.crag, props, cb);
}

ClimbDb.prototype.createAscent = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['name', 'grade', 'type', 'crag',
                          'country', 'country_code', 'country_id', 'crag_id']))
    return cb ? cb(new Error('Invalid ascent')) : false;
  props.key = [props.country_code, _.slugify(props.crag),
              _.slugify(props.name)].join('/');
  _.defaults(props, {
    sector: null,
    city: null,
    lat: null,
    lon: null,
  });
  db.createDoc(self.collections.ascent, props, cb);
}
