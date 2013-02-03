// MongoDB helper methods.

/**
* Module dependencies.
*/
var ObjectID = require('mongodb').BSONPure.ObjectID;
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');


/*
 * Insert a document into a collecting
 * adding `created` key if it doesn't
 * exist in the given props.
 */
var createDoc = exports.createDoc = function (collection, props, cb) {
  function insert() {
    collection.insert(props, { safe: true },
                      function (err, inserted) {
      if (cb) cb(err, inserted[0]);
    });
  }
  if (!props.created)
    props.created = new Date;
  insert();
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
    query._id = new ObjectID(query._id);
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
          case 'member':
            doc[collection] = {
              _id: d._id.toString(),
              key: d.key,
              displayName: d.displayName,
              role: d.role,
              facebookId: d.facebookId,
              facebookToken: d.facebookToken,
              twitterId: d.twitterId,
              twitterToken: d.twitterToken,
              twitterSecret: d.twitterSecret,
              instagramId: d.instagramId,
              instagramToken: d.instagramToken
            };
            if (d.twitter !== '')
              doc[collection].twitter = d.twitter;
            break;
          case 'post':
            doc[collection] = {
              _id: d._id.toString(),
              key: d.key,
              title: d.title,
            };
            break;
          case 'media':
            doc[collection] = {
              _id: d._id.toString(),
              key: d.key,
            };
            break;
        }
        __cb(null, docs);
      });
    });
  }
}


/**
  * Determine if all keys in the
  * given list are in the given obj.
  */
var validate = exports.validate = function (obj, keys) {
  var valid = true;
  _.each(keys, function (k) {
    if (!_.has(obj, k))
      valid = false; });
  return valid;
}


/**
  * Create a string identifier
  * for use in a URL at a given length.
  */
var createURLKey = exports.createURLKey = function (length) {
  var key = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
      'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(
          Math.random() * possible.length));
  return key;
}


/*
 * Create a string identifier for a
 * document ensuring that it's unique
 * for the given collection.
 */
var createUniqueURLKey = exports.createUniqueURLKey =
    function (collection, length, cb) {
  var key = createURLKey(length);
  collection.findOne({ key: key }, function (err, doc) {
    if (err) return cb(err);
    if (doc) createUniqueURLKey(collection, length, cb);
    else cb(null, key);
  });
}


/*
 * Make some random salt for a password.
 */
var makeSalt = exports.makeSalt = function () {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}


/*
 * Encrypt password.
 */
 var encryptPassword = exports.encryptPassword = function (password, salt) {
  return crypto.createHmac('sha1', salt)
               .update(password)
               .digest('hex');
}
