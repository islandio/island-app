// Functionality for handling members and their media.

/**
* Module dependencies.
*/
var db = require('./db');
var crypto = require('crypto');
var request = require('request');
var reds = require('reds');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var Facebook = require('node-fb');
var facebookCredentials = {
  ID: 203397619757208,
  KEY: 203397619757208,
  SECRET: 'af79cdc8b5ca447366e87b12c3ddaed2'
};
var twitterCredentials = {
  consumer_key: 'ithvzW8h1tEsUBewL3jxQ',
  consumer_secret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8',
  access_token_key: '213304250-VSHfh85LJA4a1lIX1vhk7Q1TyljF6kHYi0qQzdL6',
  access_token_secret: 'Yr77Uo7n8uNRYjRwmCmgiPQF25jVQ6vjWyqHVGFNOg'
};

/*
 * Create a db wrapper.
 */
var MemberDb = exports.MemberDb = function (dB, options, cb) {
  var self = this;
  self.dB = dB;
  self.app = options.app;
  self.collections = {};
  
  if (options.redisClient) {
    self.redisClient = options.redisClient;
    reds.createClient = function () {
      return exports.client || self.redisClient;
    };
    self.search = reds.createSearch('media');
  }

  var collections = {
    member: { index: { primaryEmail: 1, username: 1, key: 1, role: 1 } },
    post: { index: { key: 1, member_id: 1 } },
    media: { index: { type: 1, member_id: 1, post_id: 1 } },
    comment: { index: { member_id: 1, post_id: 1 } },
    view: { index: { member_id: 1, post_id: 1 } },
    hit: { index: { member_id: 1, media_id: 1 } },
    rating: { index: { member_id: 1, media_id: 1 } }
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


/*
 * Find a member by its email(s) or facebookId. If it does not exist
 * create one using the given props and the Facebook API.
 */
MemberDb.prototype.findOrCreateMemberFromFacebook =
    function (props, cb) {
  var self = this;
  delete props._raw;
  delete props._json;
  props.emails = props.emails ? _.filter(props.emails,
                    function (e) { return e !== null; }) : [];
  props.facebookId = props.id;
  delete props.id;
  self.collections.member.find({ $or: [{ emails: { $in: props.emails }},
                              { facebookId: props.facebookId }
                              ]}, { sort: { created: 1 }, limit: 1 })
                         .toArray(function (err, member) {
    if (err) return cb(err);
    if (member)
      member = _.first(member);
    if (member && member.key) {
      if (member.modified) {
        var update = { 
          facebookToken: props.facebookToken,
          facebookId: props.facebookId
        };
        self.collections.member.update({ _id: member._id },
                                      { $set: update }, { safe: true },
                                      function (err) {
          if (err) return cb(err);
          cb(null, _.extend(member, update));
        });
      } else updateFacebookData(member);
    } else
      db.createUniqueURLKey(self.collections.member,
                          8, function (err, key) {
        if (err) return cb(err);
        props.key = key;
        updateFacebookData(member);
      });
  });
  function updateFacebookData(member) {
    var facebook = new Facebook(facebookCredentials);
    Step(
      function () {
        facebook.get(props.facebookId,
                    { access_token: props.facebookToken }, this);
      },
      function (err, data) {
        if (err) return this(true);
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
        facebook.get(props.facebookId + '/albums',
                    { access_token: props.facebookToken }, this.parallel());
      },
      function (err, location, hometown, albums) {
        if (err) return this(true);
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
                      { access_token: props.facebookToken }, this);
        else this();
      },
      function (err, data) {
        if (data) {
          props.image = {
            cf_url: data.source,
            meta: { width: data.width, height: data.height },
          };
          props.thumbs = [props.image];
        }
        props.facebook = props.username;
        if (member) {
          delete props.displayName;
          if (member.name) delete props.name;
          delete member.username;
          props.username = member.username || member.key;
          props.emails = mergeMemberEmails(props.emails, member.emails,
                                          member.primaryEmail);
          _.defaults(props, member);
          props.primaryEmail = member.primaryEmail;
          self.collections.member.update({ _id: member._id },
                                          props, { safe: true }, function (err) {
            if (err) return cb(err);
            cb(null, props);
          });
        } else if (!member) {
          _.defaults(props, {
            role: 1,
            image: null,
            thumbs: null,
            confirmed: false,
            modified: false,
            config: {
              notifications: {
                comment: {
                  email: true
                }
              }
            }
          });
          props.primaryEmail = props.emails.length > 0 ?
                                props.emails[0].value : null;
          props.username = props.key;
          db.createDoc(self.collections.member, props, cb);
        }
      }
    );
  }
}


/*
 * Find a member by its email(s) or twitterId. If it does not exist
 * create one using the given props and the Twitter API.
 */
MemberDb.prototype.findOrCreateMemberFromTwitter =
    function (props, cb) {
  var self = this;
  props.emails = props.emails ? _.filter(props.emails,
                    function (e) { return e !== null; }) : [];
  props.twitterId = props.id;
  delete props.id;
  self.collections.member.find({ $or: [{ emails: { $in: props.emails }},
                                  { twitterId: props.twitterId }
                                  ]}, { sort: { created: 1 }, limit: 1 })
                         .toArray(function (err, member) {
    if (err) return cb(err);
    if (member)
      member = _.first(member);
    if (member && member.key) {
      if (member.modified) {
        var update = { 
          twitterToken: props.twitterToken,
          twitterId: props.twitterId
        };
        self.collections.member.update({ _id: member._id },
                                      { $set: update }, { safe: true },
                                      function (err) {
          if (err) return cb(err);
          cb(null, _.extend(member, update));
        });
      } else updateTwitterData(member);
    } else
      db.createUniqueURLKey(self.collections.member,
                          8, function (err, key) {
        if (err) return cb(err);
        props.key = key;
        updateTwitterData(member);
      });
  });
  function updateTwitterData(member) {
    _.extend(props, _.pick(props._json, 
          'description', 'location', 'url',
          'time_zone', 'lang'));
    delete props._raw;
    delete props._json;
    props.twitter = props.username;
    if (props.url)
      props.website = props.url;
    delete props.url;
    if (props.location)
      props.location = { name: props.location };
    if (props.lang)
      props.locale = props.lang;
    delete props.lang;
    if (props.time_zone)
      props.timezone = props.time_zone;
    delete props.time_zone;
    props.name = MemberDb.getMemberNameFromDisplayName(props.displayName);
    if (member) {
      delete props.displayName;
      if (member.name) delete props.name;
      props.username = member.username || member.key;
      props.emails = mergeMemberEmails(props.emails, member.emails,
                                      member.primaryEmail);
      _.defaults(props, member);
      props.primaryEmail = member.primaryEmail;
      self.collections.member.update({ _id: member._id },
                                      props, { safe: true },
                                      function (err) {
        if (err) return cb(err);
        cb(null, props);
      });
    } else if (!member) {
      _.defaults(props, {
        role: 1,
        image: null,
        thumbs: null,
        confirmed: false,
        modified: false,
      });
      props.username = props.key;
      db.createDoc(self.collections.member, props, cb);
    }
  }
}


/*
 * Finds a member by its email(s). If it does not exist
 * create one using the given props.
 */
MemberDb.prototype.findOrCreateMemberFromEmail =
    function (props, options, cb) {
  var self = this;
  if ('function' === typeof options) {
    cb = options;
    options = null;
  }
  if (props.password && !props.salt)
    MemberDb.dealWithPassword(props);
  self.collections.member.findOne({ emails: { $in: props.emails }},
                                  function (err, member) {
    if (err) return cb(err);
    if (member && member.key)
      if (options.safe)
        cb(new Error('DUPLICATE_KEY'));
      else cb(null, member);
    else
      db.createUniqueURLKey(self.collections.member,
                          8, function (err, key) {
        if (err) return cb(err);
        props.key = key;
        props.name = MemberDb.getMemberNameFromDisplayName(props.displayName);
        props.displayName = props.name.givenName + (props.name.middleName ?
                            ' ' + props.name.middleName : '') +
                            ' ' + props.name.familyName;
        props.username = key;
        props.confirmed = false;
        if (member) {
          _.defaults(props, member);
          self.collections.member.update({ _id: member._id },
                                          props, { safe: true }, 
                                          function (err) {
            if (err) return cb(err);
            cb(null, props);
          });
        } else if (!member) {
          _.defaults(props, {
            role: 1,
            image: null,
            thumbs: null,
            confirmed: false,
            modified: false,
          });
          db.createDoc(self.collections.member, props, cb);
        }
      });
  });
}


/*
 * Create methods for posts and comments.
 */
MemberDb.prototype.createPost = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['title', 'body', 'member']))
    return cb(new Error('Invalid post'));
  props.member_id = props.member._id;
  var memberName = props.member.displayName;
  delete props.member;
  db.createUniqueURLKey(self.collections.post,
                    8, function (err, key) {
    _.defaults(props, {
      key: key,
      ccnt: 0,
      vcnt: 0,
    });
    db.createDoc(self.collections.post, props,
              function (err, doc) {
      if (err) return cb(err);
      self.search.index(doc.title, doc._id);
      // self.search.index(doc.body.replace(/#island/g, ''), doc._id);
      self.search.index(memberName, doc._id);
      cb(null, doc);
    });
  });
}
MemberDb.prototype.createMedia = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['type', 'key', 'member_id', 'post_id']))
    return cb(new Error('Invalid media'));
  _.defaults(props, {
    tcnt: 0,
    hcnt: 0,
  });
  db.createDoc(self.collections.media, props, cb);
}
MemberDb.prototype.createView = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'post_id']))
    return cb(new Error('Invalid view'));
  _.defaults(props, {});
  Step(
    function () {
      self.findPostById(props.post_id, true, this);
    },
    function (err, post) {
      if (err) return cb(err);
      if (!post) return cb(new Error('Post not found'));
      props.post_id = post._id;
      db.createDoc(self.collections.view, props, function (err, doc) {
        if (err) return cb(err);
        self.collections.post.update({ _id: post._id }, { $inc: { vcnt: 1 }});
        cb(null, doc);
      });
    }
  );
}
MemberDb.prototype.createComment = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'post_id', 'body']))
    return cb(new Error('Invalid comment'));
  _.defaults(props, {
    likes: 0, // ?
  });
  Step(
    function () {
      self.findMemberById(props.member_id, true, this.parallel());
      self.findPostById(props.post_id, true, this.parallel());
    },
    function (err, member, post) {
      if (err) return cb(err);
      if (!member)
        return cb(new Error('Member not found'));
      if (!member.confirmed)
        return cb({ code: 'NOT_CONFIRMED', member: member });
      if (!post)
        return cb(new Error('Post not found'));
      props.post_id = post._id;
      db.createDoc(self.collections.comment, props,
                function (err, doc) {
        if (err) return cb(err);
        self.collections.post.update({ _id: post._id }, { $inc: { ccnt: 1 }});
        db.getDocIds.call(self, doc, cb);
      });
    }
  );
}
MemberDb.prototype.createRating = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'media_id', 'val']))
    return cb(new Error('Invalid rating'));
  _.defaults(props, {});
  Step(
    function () {
      self.findMediaById(props.media_id, true, this);
    },
    function (err, med) {
      var next = this;
      if (err) return cb(err);
      if (!med) return cb(new Error('Media not found'));
      props.media_id = med._id;
      db.findOne.call(self, self.collections.rating,
                  { media_id: props.media_id,
                  member_id: props.member_id }, { bare: true },
                  function (err, doc) {
        if (err) return cb(err);
        if (!doc)
          return db.createDoc(self.collections.rating, props, function (err, rat) {
            console.log(err, rat);
            if (err) return cb(err);
            self.collections.media.update({ _id: med._id },
                                          { $inc: { hcnt: props.val }},
                                          { safe: true }, function (err) {
              console.log('NEW', err, rat);
              cb(err, rat);
            });
          });
        console.log('OLD', err, doc);
        self.collections.rating.update({ _id: doc._id },
                                      { $set : { val: props.val,
                                        created: new Date } },
                                      { safe: true }, function (err) {
          if (err) return cb(err);
          console.log('UPDATE', props.val);
          self.collections.media.update({ _id: med._id },
                                        { $inc: { hcnt: props.val - doc.val }},
                                        { safe: true }, function (err) {
            if (doc)
              doc.val = props.val;
            console.log('TOTAL', props.val);
            cb(err, doc);
          });
        });
      });
    }
  );
}
MemberDb.prototype.createHit = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'media_id']))
    return cb(new Error('Invalid hit'));
  _.defaults(props, {});
  Step(
    function () {
      self.findMediaById(props.media_id, true, this);
    },
    function (err, med) {
      if (err) return cb(err);
      if (!med) return cb(new Error('Media not found'));
      props.media_id = med._id;
      db.createDoc(self.collections.hit, props, function (err, doc) {
        if (err) return cb(err);
        self.collections.media.update({ _id: med._id }, { $inc: { tcnt: 1 }});
        cb(null, doc);
      });
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
  db.find.call(self, self.collections.post, query, opts,
            function (err, posts) {
    if (err) return cb(err);
    if (posts.length === 0)
      return cb(null, []);
    Step(
      function () {
        db.fillDocList.call(self, 'media', posts, 'post_id',
                        { bare: true }, this);
      },
      function (err) {
        if (err) return cb(err);
        if (!('key' in query))
          return this();
        var next = _.after(posts.length, this);
        _.each(posts, function (post) {
          db.fillDocList.call(self, 'rating', post.medias, 'media_id',
                          { bare: true }, next);
        });
      },
      function (err) {
        cb(err, posts);
      }
    );
  });
}
MemberDb.prototype.findComments = function (query, opts, cb) {
  var self = this;
  db.find.call(self, self.collections.comment, query, opts,
            function (err, docs) {
    if (err) return cb(err);
    if (docs.length === 0)
      return cb(null, []);
    cb(err, docs);
  });
}


/*
 * Find a collection documents by _id.
 */
MemberDb.prototype.findMemberById = function (id, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  db.findOne.call(this, this.collections.member,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findPostById = function (id, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  db.findOne.call(this, this.collections.post,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findMediaById = function (id, bare, cb) {
  var self = this;
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  db.findOne.call(this, this.collections.media,
              { _id: id }, { bare: bare }, cb);
}
MemberDb.prototype.findMemberByKey = function (key, bare, cb) {
  if ('function' === typeof bare) {
    cb = bare;
    bare = false;
  }
  db.findOne.call(this, this.collections.member,
              { key: key }, { bare: bare }, cb);
}


/*
 * Get a list of all twitter names from members.
 */
MemberDb.prototype.findTwitterHandles = function (cb) {
  var self = this;
  self.collections.member.find({ role: 0 })
      .toArray(function (err, members) {
    if (err) return cb(err);
    cb(null, _.chain(members).pluck('twitter')
      .reject(function (str) { return str === ''; }).value());
  });
}


/*
 * Search redis store for matching posts.
 */
MemberDb.prototype.searchPosts = function (str, cb) {
  var self = this;
  var results = [];
  self.search.query(str).end(function (err, postIds) {
    if (err) return cb(err);
    if (postIds.length === 0) return cb(null);
    Step(
      function () {
        var group = this.group();
        _.each(postIds, function (id) {
          self.findPostById(id, group());
        });
      },
      function (err, posts) {
        if (err) return cb(err);
        if (!posts) return cb(null, []);
        posts = _.filter(posts, function (p) { return p !== null; });
        if (posts.length === 0)
          return cb(null, []);
        posts.sort(function (a, b) {
          return b.created - a.created;
        });
        Step(
          function () {
            db.fillDocList.call(self, 'media', posts, 'post_id',
                            { bare: true }, this);
          },
          function (err) {
            if (err) return cb(err);
            _.each(posts, function (post) {
              _.each(post.medias, function (med) {
                med.post = post;
                med.index = null;
                var match = _.find(post.medias, function (m, i) {
                  med.index = i;
                  return m._id.toString() === med._id.toString();
                });
              });
              if (post.medias && post.medias.length > 0)
                results = results.concat(post.medias);
            });
            cb(null, results);
          }
        );
      }
    );
  });
}


/**
  * Create a Facebook post from a postId.
  */
MemberDb.prototype.createFacebookPost = function (postId, cb) {
  var self = this;
  var facebook = new Facebook(facebookCredentials);
  Step(
    function () {
      self.findPostById(postId, this);
    },
    function (err, post) {
      if (err) return cb(err);
      if (!post) return cb(new Error('Post not found'));
      db.fillDocList.call(self, 'media', post, 'post_id',
                        { bare: true }, this);
    },
    function (err, post) {
      var videos = _.filter(post.medias, function (media) {
                            return 'video' === media.type; });
      var audios = _.filter(post.medias, function (media) {
                            return 'audio' === media.type; });
      var images = _.filter(post.medias, function (media) {
                            return 'image' === media.type; });
      var caption = '';
      if (videos.length > 0)
        caption += videos.length + ' video';
      if (videos.length > 1)
        caption += 's';
      if (audios.length > 0) {
        if (caption.length > 0)
          caption += ' | ';
        caption += audios.length + ' sound';
      } if (audios.length > 1)
        caption += 's';
      if (images.length > 0) {
        if (caption.length > 0)
          caption += ' | ';
        caption += images.length + ' photo';
      } if (images.length > 1)
        caption += 's';
      var params = {
        name: post.title,
        caption: caption,
        description: post.body,
        link: self.app.set('home_uri') + '/' + post.key,
        application: { name: 'Island', id: 203397619757208 },
        access_token: post.member.facebookToken
      };
      params.picture = images.length > 0 ? images[0].image.cf_url :
                        (videos.length > 0 ? videos[0].image.cf_url : null);
      facebook.post(post.member.facebookId + '/feed', params, this);
    },
    function (err, res) {
      if (cb) cb(err, res);
    }
  );
}


/**
  * Create a Tweet from a postId.
  */
MemberDb.prototype.createTweet = function (postId, cb) {
  var self = this;
  Step(
    function () {
      self.findPostById(postId, this);
    },
    function (err, post) {
      if (err) return cb(err);
      if (!post) return cb(new Error('Post not found'));
      db.fillDocList.call(self, 'media', post, 'post_id',
                        { bare: true }, this);
    },
    function (err, post) {
      var videos = _.filter(post.medias, function (media) {
                            return 'video' === media.type; });
      var audios = _.filter(post.medias, function (media) {
                            return 'audio' === media.type; });
      var images = _.filter(post.medias, function (media) {
                            return 'image' === media.type; });
      var caption = '';
      if (videos.length > 0)
        caption += videos.length + ' video';
      if (videos.length > 1)
        caption += 's';
      if (audios.length > 0) {
        if (caption.length > 0)
          caption += ', ';
        caption += audios.length + ' sound';
      } if (audios.length > 1)
        caption += 's';
      if (images.length > 0) {
        if (caption.length > 0)
          caption += ', ';
        caption += images.length + ' photo';
      } if (images.length > 1)
        caption += 's';
      var coms = caption.match(/,/g);
      if (coms) {
        var comIndex = coms.length > 1 ?
                        caption.lastIndexOf(',') : caption.indexOf(',');
        caption = caption.substr(0, comIndex)
                  + ' and' + caption.substr(comIndex + 1);
      }
      var status = 'Just added ' + caption + ' to Island: "$" '
                      + self.app.set('home_uri') + '/' + post.key;
      var title = post.title;
      // 1 for the $ sign and 7 for http://
      var rem = 140 - (status.length + title.length - 1 - 7);
      if (rem < 0)
        title = title.substr(0, title.length + rem - 3) + '...';
      status = status.replace('$', title);
      request.post({
        uri: 'https://api.twitter.com/1/statuses/update.json',
        form: {
          status: status,
          include_entities: true,
          trim_user: true
        },
        oauth: {
          consumer_key: twitterCredentials.consumer_key,
          consumer_secret: twitterCredentials.consumer_secret,
          token: post.member.twitterToken,
          token_secret: post.member.twitterSecret
        }
      }, 
      function (err, res, body) {
        if (cb) cb(err, body);
      });
    }
  );
}


/**
  * Takes a member, makes salt
  * and encrypts password.
  * Exists only for public access
  * to password methods.
  */
MemberDb.dealWithPassword = function (member) {
  member.salt = makeSalt();
  member.password = encryptPassword(member.password,
                                    member.salt);
  return member;
}

/*
 * Determine whether or not the given string is
 * the user's actual password.
 */
MemberDb.authenticateLocalMember = function (member, str) {
  return encryptPassword(str, member.salt) === member.password;
}


/**
  * Parse displayName into name parts.
  */
MemberDb.getMemberNameFromDisplayName = function (displayName) {
  var name = _.without(displayName.split(' '), '');
  var family = '';
  var given = _.capitalize(name[0]);
  var middle = null;
  if (name.length > 2) {
    middle = _.capitalize(name[1]);
    family = _.capitalize(name[2]);
  } else if (name.length > 1)
    family = _.capitalize(name[1]);
  return {
    familyName: family,
    givenName: given,
    middleName: middle,
  };
}


/**
  * Combine shitty passport email lists.
  */
function mergeMemberEmails(a, b, first) {
  if (!a) a = [];
  if (!b) b = [];
  var tmpA = _.pluck(a, 'value');
  var tmpB = _.pluck(b, 'value');
  var tmpC = _.union(tmpA, tmpB);
  if (first)
    tmpC = _.without(tmpC, first);
  var c = [];
  _.each(tmpC, function (val) {
    c.push({ value: val }); });
  if (first)
    c.unshift({ value: first });
  return c;
}

/*
 * Make some random salt for a password.
 */
function makeSalt() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}


/*
 * Encrypt password.
 */
function encryptPassword(password, salt) {
  return crypto.createHmac('sha1', salt)
               .update(password)
               .digest('hex');
}
