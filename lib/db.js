/*
 * db.js: MongoDB wrapper.
 *
 */

// Module dependencies.
var mongodb = require('mongodb');
var crypto = require('crypto');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var Step = require('step');
var oid = exports.oid = require('mongodb').BSONPure.ObjectID;

// Establish a db connection wrapper.
exports.Connection = function (uri, options, cb) {
  this.options = options;

  // Adds a collection to this db instance.
  this.add = function (name, conf, cb) {
    if (!this.db)
      return cb('Connect to a db instance before adding a collection');
    var collection;
    var self = this;
    Step(
      function () {
        self.db.collection(name, _.bind(function (err, col) {
          if (err) return this(err);
          exports[_.capitalize(col.collectionName) + 's'] = col;
          if (options.ensureIndexes) {
            util.log('Ensuring `' + col.collectionName + '` collection indexes');
            var _next = _.after(conf.indexes.length, next);
            _.each(conf.indexes, function (x, i) {
              col.dropIndexes(function () {
                col.ensureIndex(x, {unique: conf.uniques[i]}, _next);
              });
            });
          } else this();
        }, this));
      },
      function (err) { cb(err); }
    );
  };

  // Connect
  mongodb.connect(uri, {server: {poolSize: 4}}, _.bind(function (err, db) {
    if (!err) util.log('Connected to MongoDB (' + uri + ')');
    this.db = db;
    cb(err, this);
  }, this));

}

/*
 * Insert a document adding `created` and `updated` keys if
 * they doesn't exist in the given props.
 */
mongodb.Collection.prototype.create = function (props, cb) {
  if (!props.created)
    props.created = new Date;
  if (!props.updated)
    props.updated = new Date;
  this.insert(props, {safe: true}, function (err, ins) {
    if (cb) cb(err, ins[0]);
  });
}

/*
 * Get a document by query.
 */
mongodb.Collection.prototype.read = function (query, cb) {
  this.findOne(query, cb);
}

/*
 * Update a document by query with the given props.
 */
mongodb.Collection.prototype._update = mongodb.Collection.prototype.update;
mongodb.Collection.prototype.update = function (query, props, cb) {
  props.$set = props.$set || {};
  props.$set.updated = new Date;
  this._update(query, props, {safe: true}, cb);
}

/*
 * Delete a document by query.
 */
mongodb.Collection.prototype.delete = function (query, cb) {
  this.remove(query, {safe: true}, cb);  
}

/*
 * Determine if a doc exists with a specified
 * key/val pair for the collection.
 */
mongodb.Collection.prototype.available = function (query, cb) {
  this.findOne(query, function (err, doc) {
    if (err) return cb(err);
    cb(err, !doc);
  });
}

/*
 * Find collection documents and
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
var find = exports.find = function (collection, query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var bare = opts.bare;
  delete opts.bare;
  collection.find(query, opts)
            .toArray(function (err, docs) {
    if (err) return cb(err);
    if (bare) return cb(null, docs);
    getDocIds.call(self, docs, cb);
  });
}

/*
 * Find a document and
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
var findOne = exports.findOne = function (collection, query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var bare = opts.bare;
  delete opts.bare;
  if (_.has(query, '_id') && 'string' === typeof query._id)
    query._id = new oid(query._id);
  collection.findOne(query, opts,
                    function (err, doc) {
    if (err) return cb(err);
    if (bare) return cb(null, doc);
    getDocIds.call(self, doc, cb);
  });
}

/*
 * Fill document lists.
 */
var fillDocList = exports.fillDocList = function (list, docs, key, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var collection = self.collections[list];
  list += 's';
  var isArray = _.isArray(docs);
  if (!isArray)
    docs = [docs];
  if (docs.length === 0)
    return done();
  var _done = _.after(docs.length, done);
  _.each(docs, function (doc) {
    var query = {};
    query[key] = doc._id;
    find.call(self, collection, query, { bare: opts.bare },
              function (err, results) {
      if (err) return cb(err);
      doc[list] = results;
      _done();
    });
  });
  function done() {
    if (!isArray)
      docs = _.first(docs);
    cb(null, docs);
  }
}

/**
 * Replace _ids with documents.
 */
var getDocIds = exports.getDocIds = function (docs, cb) {
  var self = this;
  var _cb;
  if (_.isArray(docs)) {
    if (docs.length === 0)
      return cb(null, docs);
    _cb = _.after(docs.length, cb);
    _.each(docs, handleDoc);
  } else {
    _cb = cb;
    handleDoc(docs);
  }
  function handleDoc(doc) {
    var collections = {};
    _.each(doc, function (id, key) {
      if ('_id' === key) return;
      var u = key.indexOf('_');
      var col = u !== -1 ? key.substr(0, u) : null;
      if (col) {
        collections[col] = id;
        delete doc[key];
      }
    });
    var num = _.size(collections);
    if (num === 0) return _cb(null, docs);
    var __cb = _.after(num, _cb);
    _.each(collections, function (id, collection) {
      findOne.call(self, self.collections[collection],
                  { _id: id }, function (err, d) {
        if (err) return cb(err);
        if (!d) {
          doc[collection] = null;
          return __cb(null, docs);
        }
        switch (collection) {
          case 'user':
            doc[collection] = {
              _id: d._id.toString(),
              id: d.id,
              name: d.name,
              email: d.email
            };
            break;
          case 'team':
            doc[collection] = {
              _id: d._id.toString(),
              id: d.id
            };
            break;
        }
        __cb(null, docs);
      });
    });
  }
}

/*
 * Encrypt password.
 */
var encrypt = exports.encrypt = function (password, salt) {
  return crypto.createHmac('sha1', salt)
               .update(password)
               .digest('hex');
}