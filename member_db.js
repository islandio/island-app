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
MemberDb.prototype.findOrCreateMemberFromOpenId = function (props, cb) {
  var self = this;
  props.primaryEmail = props.emails[0].value;
  self.collections.member.findOne({ primaryEmail: props.primaryEmail },
                                  function (err, member) {
    if (err) return cb(err);
    if (!member) {
      _.defaults(props, {
        meta: {},
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
  if (!_.has(props, ['title', 'body', 'type', 'member_id', 'attached']))
    return cb(new Error('Invalid media.'));
  var tags = props.tags && props.tags !== '' ?
      makeTags(props.tags) : [];
  _.defaults(props, {
    key: makeURLKey(8),
    comments: [],
    meta: {
      tags: tags,
      ratings: [],
      hits: 0,
    },
  });
  createDoc(this.collections.media, props, cb);
}
MemberDb.prototype.createComment = function (props, cb) {
  if (!_.has(props, ['body', 'member_id', 'media_id']))
    return cb(new Error('Invalid comment.'));
  _.defaults(props, {
    likes: 0,
  });
  createDoc(this.collections.comment, props, cb);
}


/*
 * Add a rating to existing media.
 */
MemberDb.prototype.addMediaRating = function (props, cb) {
  if (!_.has(props, ['member_id', 'hearts']))
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
 * Find methods for media and comments.
 */
MemberDb.prototype.findMedia = function (query, opts, cb) {
  find.call(this, this.collections.media, query, opts, cb);
}
MemberDb.prototype.findComments = function (query, opts, cb) {
  find.call(this, this.collections.comment, query, opts, cb);
}


/*
 * Find a collection documents by _id..
 */
MemberDb.prototype.findMemberById = function (id, cb) {
  findById(this.collections.member, id, cb);
}
MemberDb.prototype.findMediaById = function (id, cb) {
  findById(this.collections.media, id, cb);
}


/*
 * Get a list of all twitter names from members.
 */
MemberDb.prototype.findTwitterNames = function (cb) {
  var self = this;
  self.collections.member.find({})
      .toArray(function (err, members) {
    if (err) return cb(err);
    cb(null, _(members).pluck('twitter')
      .reject(function (str) { return str === ''; }));
  });
}


/**
 * Replace _ids with documents.
 */
MemberDb.prototype.expandDocIds = function (docs, cb) {
  var self = this;
  if (docs.length === 0)
    return cb(null, docs);
  var _cb = _.after(docs.length, cb);
  _.each(docs, function (doc) {
    var collections = {};
    _.each(doc, function (id, key) {
      var u = key.indexOf('_');
      var col = u !== -1 ? key.substr(0, u) : null;
      if (col) {
        collections[col] = id;
        delete doc[col];
      }
    });
    var __cb = _.after(_.size(collections), _cb);
    _.each(collections, function (id, collection) {
      findById(self.collections[collection], id,
              function (err, d) {
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
  });
}


// MemberDb.prototype.expandDocIds = function (docs, cb) {
//   var self = this;
//   if (docs.length === 0)
//     return cb(null, docs);
//   var _cb = _.after(docs.length, cb);
//   _.each(docs, function (doc) {
//     var __cb = _.after(Boolean(doc.memberId)
//                       + Boolean(doc.mediaId), _cb);
//     if (doc.memberId)
//       findById(self.collections.members, doc.memberId,
//               function (err, mem) {
//         if (err) return cb(err);
//         doc.member = {
//           _id: mem._id.toString(),
//           displayName: mem.displayName,
//         };
//         if (mem.twitter !== '')
//           doc.member.twitter = mem.twitter;
//         delete doc.memberId;
//         __cb(null, docs);
//       });
//     if (doc.mediaId)
//       findById(self.collections.media, doc.mediaId,
//               function (err, med) {
//         if (err) return cb(err);
//         doc.media = {
//           _id: med._id.toString(),
//           key: med.key,
//           type: med.type,
//           title: med.title,
//         };
//         delete doc.mediaId;
//         __cb(null, docs);
//       });
//   });
// }


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
    self.expandDocIds(docs, cb);
  });
}


/*
 * Find a document by its _id.
 */
function findById(collection, id, cb) {
  if ('string' === typeof id)
    id = new ObjectID(id);
  collection.findOne({ _id: id },
                    function (err, doc) {
    cb(err, doc);
  });
}


/**
  * Create a string identifier
  * for use in a URL at a given length.
  */
function makeURLKey(length) {
  var key = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
      'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(
          Math.random() * possible.length));
  return key;
}

/**
 * Make array of searchable terms from str
 */
function makeTags(str) {
  str = str.replace(/[~|!|@|#|$|%|^|&|*|(|)|_|+|`|-|=|[|{|;|'|:|"|\/|\\|?|>|.|<|,|}|]|]+/gi, '');
  str = str.replace(/\s{2,}/g, ' ');
  return str.toLowerCase().trim().split(' ');
}

