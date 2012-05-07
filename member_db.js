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
var reds = require('reds');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var Facebook = require('node-fb');
var fbInfo = { SECRET: 'af79cdc8b5ca447366e87b12c3ddaed2',
               ID: 203397619757208 };


/*
 * Create a db instance.
 */
var MemberDb = exports.MemberDb = function (db, options, cb) {
  var self = this;
  self.db = db;
  self.collections = {};
  self.search = reds.createSearch('media');

  var collections = {
    member: { index: { primaryEmail: 1, key: 1, role: 1 } },
    post: { index: { key: 1, member_id: 1 } },
    media: { index: { type: 1, member_id: 1 } },
    comment: { index: { member_id: 1, media_id: 1 } },
    view: { index: { member_id: 1, media_id: 1 } },
    hit: { index: { member_id: 1, media_id: 1 } },
    rating: { index: { member_id: 1, media_id: 1 } },
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
    if (member && member.provider) {
      self.collections.member.update({ primaryEmail: props.primaryEmail },
                                    { $set : { accessToken: props.accessToken } },
                                    { safe: true }, function (err) {
        if (err) return cb(err);
        member.accessToken = props.accessToken;
        cb(null, member);
      });
    } else {
      delete props._raw;
      delete props._json;
      createUniqueURLKey(self.collections.member,
                          8, function (err, key) {
        if (err) return cb(err);
        props.key = key;
        var facebook = new Facebook(fbInfo);
        Step(
          function () {
            facebook.get(props.id,
                        { access_token: props.accessToken }, this);
          },
          function (err, data) {
            if (err) return cb(err);
            _.extend(props, {
              locale: data.locale,
              timezone: data.timezone,
              gender: data.gender,
              birthday: data.birthday,
              website: data.website,
            });
            if (data.location)
              facebook.get(data.location.id, {}, this.parallel());
            else this.parallel()();
            if (data.hometown)
              facebook.get(data.hometown.id, {}, this.parallel());
            else this.parallel()();
            facebook.get(props.id + '/albums',
                        { access_token: props.accessToken }, this.parallel());
          },
          function (err, location, hometown, albums) {
            if (err) return cb(err);
            if (location) {
              props.location = { name: location.name };
              _.extend(props.location, location.location);
            } else props.location = null;
            if (hometown) {
              props.hometown = { name: hometown.name };
              _.extend(props.hometown, hometown.location);
            } else props.hometown = null;
            var photo = _.find(albums, function (album) {
                                return album.name === 'Cover Photos'; });
            if (photo && photo.cover_photo)
              facebook.get(photo.cover_photo,
                          { access_token: props.accessToken }, this);
            else this();
          },
          function (err, data) {
            if (err) return cb(err);
            props.picture = data || null;
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
            }
          }
        );
      });
    }
  });
}


/*
 * Create methods for posts and comments.
 */
MemberDb.prototype.createPost = function (props, cb) {
  var self = this;
  if (!validate(props, ['title', 'body', 'member']))
    return cb(new Error('Invalid post'));
  props.member_id = props.member._id;
  var memberName = props.member.displayName;
  delete props.member;
  createUniqueURLKey(self.collections.post,
                    8, function (err, key) {
    _.defaults(props, {
      key: key,
    });
    createDoc(self.collections.post, props,
              function (err, doc) {
      if (err) return cb(err);
      self.search.index(doc.title, doc._id);
      self.search.index(doc.body, doc._id);
      self.search.index(memberName, doc._id);
      getDocIds.call(self, doc, cb);
    });
  });
}
MemberDb.prototype.createMedia = function (props, cb) {
  var self = this;
  if (!validate(props, ['type', 'key', 'member_id', 'post_id']))
    return cb(new Error('Invalid media'));
  _.defaults(props, {});
  createDoc(self.collections.media, props,
            function (err, doc) {
    if (err) return cb(err);
    getDocIds.call(self, doc, cb);
  });
}
MemberDb.prototype.createView = function (props, cb) {
  var self = this;
  if (!validate(props, ['member_id', 'post_id']))
    return cb(new Error('Invalid view'));
  _.defaults(props, {});
  Step(
    // TODO: Verify that the user has
    // permission to add a view.
    function () {
      self.findPostById(props.post_id, true, this);
    },
    function (err, post) {
      if (err) return cb(err);
      if (!post) return cb(new Error('Post not found'));
      props.post_id = post._id;
      createDoc(self.collections.view, props, cb);
    }
  );
}
MemberDb.prototype.createComment = function (props, cb) {
  var self = this;
  if (!validate(props, ['member_id', 'post_id', 'body']))
    return cb(new Error('Invalid comment'));
  _.defaults(props, {
    likes: 0, // ?
  });
  Step(
    // TODO: Verify that the user has
    // permission to comment.
    function () {
      self.findPostById(props.post_id, this);
    },
    function (err, post) {
      if (err) return cb(err);
      if (!post) return cb(new Error('Post not found'));
      props.post_id = post._id;
      createDoc(self.collections.comment, props,
                function (err, doc) {
        if (err) return cb(err);
        getDocIds.call(self, doc, cb);
      });
    }
  );
}
MemberDb.prototype.createRating = function (props, cb) {
  var self = this;
  if (!validate(props, ['member_id', 'media_id', 'val']))
    return cb(new Error('Invalid rating'));
  _.defaults(props, {});
  Step(
    // TODO: Verify that the user has
    // permission to add a rating.
    function () {
      self.findMediaById(props.media_id, true, this);
    },
    function (err, med) {
      var next = this;
      if (err) return cb(err);
      if (!med) return cb(new Error('Media not found'));
      props.media_id = med._id;
      findOne.call(self, self.collections.rating,
                  { media_id: props.media_id,
                  member_id: props.member_id }, { bare: true },
                  function (err, doc) {
        if (err) return cb(err);
        if (!doc)
          return createDoc(self.collections.rating, props, cb);
        self.collections.rating.update({ _id: doc._id },
                                      { $set : { val: props.val,
                                        created: new Date } },
                                      { safe: true }, function (err) {
          doc.val = props.val;
          cb(err, doc);
        });
      });
    }
  );
}
MemberDb.prototype.createHit = function (props, cb) {
  var self = this;
  if (!validate(props, ['member_id', 'media_id']))
    return cb(new Error('Invalid hit'));
  _.defaults(props, {});
  Step(
    // TODO: Verify that the user has
    // permission to add a hit. ?
    function () {
      self.findMediaById(props.media_id, true, this);
    },
    function (err, med) {
      if (err) return cb(err);
      if (!med) return cb(new Error('Media not found'));
      props.media_id = med._id;
      createDoc(self.collections.hit, props, cb);
    }
  );
}


/*
 * Find methods for posts and comments.
 */
MemberDb.prototype.findPosts = function (query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  find.call(self, self.collections.post, query, opts,
          function (err, posts) {
    if (err) return cb(err);
    if (posts.length === 0)
      return cb(null, []);
    Step(
      function () {
        fillDocList.call(self, 'media', posts, 'post_id',
                        { bare: true }, this.parallel());
        fillDocList.call(self, 'comment', posts, 'post_id',
                        this.parallel());
        fillDocList.call(self, 'view', posts, 'post_id',
                        this.parallel());
      },
      function (err) {
        if (err) return cb(err);
        var next = this;
        _.each(posts, function (post) {
          fillDocList.call(self, 'rating', post.medias, 'media_id',
                          { bare: true }, next.parallel());
          fillDocList.call(self, 'hit', post.medias, 'media_id',
                          { bare: true }, next.parallel());
        });
      },
      function (err) {
        cb(err, posts);
      }
    );
  });
}
MemberDb.prototype.findMedia = function (query, opts, cb) {
  var self = this;
  if ('function' === typeof opts) {
    cb = opts;
    opts = {};
  }
  var fill = opts.fill;
  delete opts.fill;
  find.call(self, self.collections.media, query, opts,
          function (err, media) {
    if (err) return cb(err);
    if (!fill || fill.length === 0)
      return cb(null, media);
    Step(
      function () {
        var next = this;
        _.each(fill, function (f) {
          fillDocList.call(self, f, media, 'media_id',
                          { bare: true }, next.parallel());
        });
      },
      function (err) {
        cb(err, media);
      }
    );
  });
}
MemberDb.prototype.findComments = function (query, opts, cb) {
  find.call(this, this.collections.comment, query, opts, cb);
}


/*
 * Find a collection documents by _id.
 */
MemberDb.prototype.findMemberById = function (id, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  findOne.call(this, this.collections.member,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findPostById = function (id, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  findOne.call(this, this.collections.post,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findMediaById = function (id, bare, cb) {
  var self = this;
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  findOne.call(this, this.collections.media,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findMemberByKey = function (key, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  findOne.call(this, this.collections.member,
              { key: key }, { bare: bare }, cb);
}


/*
 * Get a list of all twitter names from members.
 */
MemberDb.prototype.findTwitterHandles = function (cb) {
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
MemberDb.prototype.searchPosts = function (str, cb) {
  var self = this;
  var results = [];
  self.search.query(str).end(function (err, postIds) {
    if (err) return cb(err);
    if (postIds.length === 0) return cb(null);
    var _next = _.after(postIds.length, done);
    _.each(postIds, function (id) {
      self.findPostById(id, function (err, post) {
        if (err) return cb(err);
        if (!post) return _next(null);
        fillDocList.call(self, 'media', post,
                        'post_id', function (err) {
          if (err) return cb(err);
          if (post.medias && post.medias.length > 0)
            results = results.concat(post.medias);
          _next(null);
        });
      });
    });
  });
  function done() {
    cb(null, results.sort(function (a, b) {
      return b.created - a.created;
    }));
  }
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
function findOne(collection, query, opts, cb) {
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
function fillDocList(list, docs, key, opts, cb) {
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
              key: d.key,
              displayName: d.displayName,
              role: d.role,
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

