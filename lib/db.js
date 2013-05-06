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

// Establish a db connection wrapper (constructor).
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
 * Inflate (replace) +_ids with documents.
 */
var inflate = exports.inflate = function (docs, cb) {
  var _cb;
  if (_.isArray(docs)) {
    if (docs.length === 0)
      return cb(null, docs);
    _cb = _.after(docs.length, cb);
    _.each(docs, handle);
  } else {
    _cb = cb;
    handle(docs);
  }
  function handle(doc) {
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
      exports[_.capitalize(collection) + 's'].read({_id: id},
          function (err, d) {
        if (err) return cb(err);
        if (!d) {
          doc[collection] = null;
          return __cb(null, docs);
        }
        switch (collection) {
          case 'member':
            doc[collection] = {
              _id: d._id,
              username: d.username,
              displayName: d.displayName
            };
            break;
          case 'post':
            doc[collection] = {
              _id: d._id,
              key: d.key,
              title: d.title,
            };
            break;
          case 'media':
            doc[collection] = {
              _id: d._id,
              key: d.key,
            };
            break;
        }
        __cb(null, docs);
      });
    });
  }
}

/*
 * Fill document +_id lists with corresponding documents.
 */
var fill = exports.fill = function (docs, source, key, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  var collection = exports[source];
  if (!collection) return cb('Source collection not found');
  if (!_.isArray(docs)) docs = [docs];

  Step(
    function () {
      if (docs.length === 0) return this();
      var next = _.after(docs.length, this);
      _.each(docs, function (doc) {
        var query = {};
        query[key] = doc._id;
        collection.list(query, opts, function (err, list) {
          if (err) return cb(err);
          doc[source.toLowerCase()] = list;
          next();
        });
      });
    },
    function (err) {
      cb(err, _.isArray(docs) ? docs: _.first(docs));
    }
  );

}

/*
 * Encrypt password.
 */
var encrypt = exports.encrypt = function (password, salt) {
  return crypto.createHmac('sha1', salt)
               .update(password)
               .digest('hex');
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
 * List documents and optionally
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
mongodb.Collection.prototype.list = function (query, opts, cb) {
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var _inflate = opts.inflate;
  var ensure = opts.ensure;
  delete opts.inflate;
  delete opts.ensure;
  this.find(query, opts).toArray(_.bind(function (err, docs) {
    if (err) return cb(err);
    if (!_inflate) return cb(null, docs);
    inflate(docs, function (err, docs) {
      if (err) return cb(err);
      if (!ensure) return cb(null, docs);
      cb(null, _.reject(docs, function (doc) {
        var reject = false;
        _.each(ensure, function (e) {
          if (!doc[e]) reject = true; 
        });
        return reject;
      }));
    });
  }, this));
}

/*
 * Find a document and
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
// var findOne = exports.findOne = function (collection, query, opts, cb) {
//   var self = this;
//   if ('function' === typeof opts) {
//     cb = opts;
//     opts = {};
//   }
//   var bare = opts.bare;
//   delete opts.bare;
//   if (_.has(query, '_id') && 'string' === typeof query._id)
//     query._id = new oid(query._id);
//   collection.findOne(query, opts,
//                     function (err, doc) {
//     if (err) return cb(err);
//     if (bare) return cb(null, doc);
//     getDocIds.call(self, doc, cb);
//   });
// }

