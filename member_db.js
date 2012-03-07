// Functionality for handling members and their media.

/** Notes:
 *
 *
 *
 *
 */

/**
* Module dependencies.
*/
var ObjectID = require('mongodb').BSONPure.ObjectID;
var search = require('reds').createSearch('media');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');


/*
 * Create a db instance.
 */
var MemberDb = exports.MemberDb = function (db, options, cb) {
  var self = this;
  self.db = db;
  self.collections = {};

  var collections = {
    member: { index: { primaryEmail: 1, role: 1 } },
    media: { index: { key: 1, type: 1, 'meta.tags': 1, member_id: 1 } },
    comment: { index: { member_id: 1, media_id: 1 } },
    sessions: {},
  };

  Step(
    function () {
      var group = this.group();
      _.each(collections, function (k, name) {
        db.collection(name, group());
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


/*
 * Find a member by its primaryEmail. If it does not exist
 * create one using the given props.
 */
MemberDb.prototype.findOrCreateMemberFromFacebook = function (props, cb) {
  var self = this;
  props.primaryEmail = props.emails[0].value;
  self.collections.member.findOne({ primaryEmail: props.primaryEmail },
                                  function (err, member) {
    if (err) return cb(err);
    if (member && !member.provider) {
      _.defaults(props, member);
      self.collections.member.update({ primaryEmail: props.primaryEmail },
                                      props, { safe: true }, function (err) {
        if (err) return cb(err);
        cb(null, props);
      });
    } else if (!member) {
      _.defaults(props, {
        role: 1,
        twitter: '',
      });
      createDoc(self.collections.member, props, cb);
    } else cb(null, member);
  });
}


/*
 * Create methods for media and comments.
 */
MemberDb.prototype.createMedia = function (props, cb) {
  var self = this;
  if (!validate(props, ['title', 'body',
      'type', 'member', 'attached']))
    return cb(new Error('Invalid media'));
  props.member_id = props.member._id;
  var memberName = props.member.displayName;
  delete props.member;
  delete props['meta.tags'];
  createUniqueURLKey(self.collections.media,
                    8, function (err, key) {
    // var tags = makeTags(props['meta.tags']);
    _.defaults(props, {
      key: key,
      comments: [],
      meta: {
        // tags: tags,
        ratings: [],
        hits: 0,
      },
    });
    createDoc(self.collections.media, props,
              function (err, doc) {
      if (err) return cb(err);
      search.index(doc.title, doc._id);
      search.index(doc.body, doc._id);
      search.index(memberName, doc._id);
      getDocIds.call(self, doc, cb);
    });
  });
}
MemberDb.prototype.createComment = function (props, cb) {
  if (!validate(props, ['body', 'member_id', 'media_id']))
    return cb(new Error('Invalid comment'));
  _.defaults(props, {
    likes: 0,
  });
  createDoc(this.collections.comment, props, cb);
}


/*
 * Find methods for media and comments.
 */

MemberDb.prototype.findMedia = function (query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  find.call(self, self.collections.media, query, opts,
          function (err, media) {
    var _cb = _.after(media.length, cb);
    _.each(media, function (med) {
      if (med.comments.length === 0)
        return _cb(null, media);
      var __cb = _.after(med.comments.length, _cb);
      _.each(med.comments, function (commentId, i) {
        self.findCommentById(commentId,
                            function (err, comment) {
          if (err) return cb(err);
          med.comments[i] = comment;
          __cb(null, media);
        });
      });
    });
  });
}
MemberDb.prototype.findComments = function (query, opts, cb) {
  find.call(this, this.collections.comment, query, opts, cb);
}


/*
 * Find a collection documents by _id.
 */
MemberDb.prototype.findMemberById = function (id, cb) {
  findOne.call(this, this.collections.member,
              { _id: id }, cb); }
MemberDb.prototype.findMediaById = function (id, cb) {
  findOne.call(this, this.collections.media,
              { _id: id }, cb); }
MemberDb.prototype.findCommentById = function (id, cb) {
  findOne.call(this, this.collections.comment,
              { _id: id }, cb); }


/*
 * Get a list of all twitter names from members.
 */
MemberDb.prototype.findTwitterNames = function (cb) {
  var self = this;
  self.collections.member.find({})
      .toArray(function (err, members) {
    if (err) return cb(err);
    cb(null, _.chain(members).pluck('twitter')
      .reject(function (str) { return str === ''; }).value());
  });
}


/*
 * Add a rating to existing media.
 */
MemberDb.prototype.addMediaRating = function (props, cb) {
  if (!validate(props, ['member_id', 'hearts']))
    return cb(new Error('Invalid rating.'));

  // count hearts
  // if (this.meta.ratings) {
  //   var hearts = 0;
  //   for (var i=0; i < this.meta.ratings.length; i++) {
  //     hearts += this.meta.ratings[i].hearts;
  //   }
  //   this.meta.hearts = hearts;
  // }

  cb();
}


/*
 * Insert a document into a collecting
 * adding `created` key if it doesn't
 * exist in the given props.
 */
function createDoc(collection, props, cb) {
  function insert() {
    collection.insert(props, { safe: true },
                      function (err, inserted) {
      cb(err, inserted[0]);
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
function find(collection, query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  collection.find(query, opts)
            .toArray(function (err, docs) {
    if (err) return cb(err);
    getDocIds.call(self, docs, cb);
  });
}


/*
 * Find a document and
 * replace *_ids with the document
 * from the cooresponding collection
 * specified by given _id.
 */
function findOne(collection, query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  if (_.has(query, '_id') && 'string' === typeof query._id)
    query._id = new ObjectID(query._id);
  collection.findOne(query, opts,
                    function (err, doc) {
    if (err) return cb(err);
    getDocIds.call(self, doc, cb);
  });
}


/**
 * Replace _ids with documents.
 */
function getDocIds(docs, cb) {
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
        switch (collection) {
          case 'member':
            doc[collection] = {
              _id: d._id.toString(),
              displayName: d.displayName,
            };
            if (d.twitter !== '')
              doc[collection].twitter = d.twitter;
            break;
          case 'media':
            doc[collection] = {
              _id: d._id.toString(),
              key: d.key,
              type: d.type,
              title: d.title,
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
function validate(obj, keys) {
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
function createURLKey(length) {
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
function createUniqueURLKey(collection, length, cb) {
  var key = createURLKey(length);
  collection.findOne({ key: key }, function (err, doc) {
    if (err) return cb(err);
    if (doc) createUniqueURLKey(collection, length, cb);
    else cb(null, key);
  });
}


/**
 * Make array of searchable terms from str
 */
function makeTags(str) {
  if (!str || str === '') return [];
  str = str.replace(/[~|!|@|#|$|%|^|&|*|(|)|_|+|`|-|=|[|{|;|'|:|"|\/|\\|?|>|.|<|,|}|]|]+/gi, '');
  str = str.replace(/\s{2,}/g, ' ');
  return str.toLowerCase().trim().split(' ');
}

