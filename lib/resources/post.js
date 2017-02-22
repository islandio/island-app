/*
 * post.js: Handling for the post resource.
 *
 */

// Module Dependencies
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
var _s = require('underscore.string');
var profiles = require('island-collections').profiles;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "type": <String>,
    "title": <String>,
    "body": <String>,
    "location": {
      "latitude": <Number>,
      "longitude": <Number>
    },
    "product": {
      "sku": <Number>,
      "price": <String>, (dollars)
      "type": <String>, (digital, tangible)
      "subtype": <String>, (Short, Feature-length)
    },
    "author_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }
*/

var BLACKLIST = [
  'sessions',
  'efforts',
  'ticks',
  'ascents',
  'crags',
  'logs'
];

// Do any initializations
exports.init = function () {
  return this.routes();
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var cache = app.get('cache');
  var sharing = app.get('sharing');

  // Create
  app.post('/api/posts', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }
    if (!req.body.assembly && (!req.body.body || req.body.body === '')) {
      return res.status(403).send({error: 'Post invalid'});
    }

    var type = req.body.type;
    var typeResource = type ? _s.capitalize(type) + 's': false;

    var title = req.body.title;
    var body = req.body.body;
    var files = req.body.assembly ? req.body.assembly.results: {};
    var facebook = req.body.facebook;
    var twitter = req.body.twitter;
    var pub = req.body.public !== 'false' && req.body.public !== false;

    // Attempt to use title slug for the url key.
    var key = title && title !== '' ? _s.slugify(title): null;
    if (!key || key.length < 8 ||
        key === req.user.username ||
        key === req.user.instagram ||
        _.contains(BLACKLIST, key)) {
      key = iutil.createId_32();
    }

    var props = {
      body: body,
      title: title,
      type: 'image',
      product: {
        sku: null,
        price: null,
        type: null,
        subtype: null,
      },
      key: [req.user.username, key].join('/'),
      author_id: req.user._id,
      public: pub
    };
    if (type && req.body.parent_id) {
      props.parent_id = db.oid(req.body.parent_id);
    }

    // Add type.
    if (_.isEmpty(files)) {
      delete props.type;
    } else {
      _.each(files, function (v) {
        _.each(v, function (file) {
          if (file.type === 'video') {
            props.type = 'video';
          }
        });
      });
    }
    // Check for video link.
    if (iutil.parseVideoURL(props.body)) {
      props.type = 'video';
    }

    var mentions = iutil.atmentions(props.body);
    var mentionDocs;

    Step(
      function() {
        var group = this.group();
        _.each(mentions, function(m) {
          db.Members.read({username: m}, group());
        });
      },
      function (err, _mentionDocs) {
        if (err) return this(err);
        mentionDocs = _mentionDocs;

        for (var i = 0; i < mentions.length; i++) {
          if (mentionDocs[i]) {
            // The unicode symbols have no plain-text representation
            // They are control characters that we use to demarcate a validated
            // username.
            props.body = props.body.replace('@' + mentions[i],
                '\u0091' + '@' + mentions[i] + '\u0092');
          }
        }

        if (!props.parent_id) {
          return this();
        }

        // Get post parent.
        db[typeResource].read({_id: props.parent_id}, this);
      },
      function (err, parent) {
        if (props.parent_id && errorHandler(err, req, res, parent, 'parent')) {
          return;
        } else if (errorHandler(err, req, res)) {
          return;
        }

        db.Posts.create(props, {inflate: {author: profiles.member},
            force: {key: 1}}, function (err, doc) {
          if (errorHandler(err, req, res)) return;

          cache.index('posts', doc, ['title']);

          // This is new so no need to fill comments.
          doc.comments = [];

          var objs = [];
          Step(
            function () {

              // Build media objects from the files.
              _.each(files, function (v, k) {
                if (k !== 'image_full' &&
                    k !== 'image_full_gif' &&
                    k !== 'video_encode_iphone' &&
                    k !== 'video_encode_ipad' &&
                    k !== 'video_encode_hd' &&
                    k !== 'audio_encode') {
                  return;
                }
                _.each(v, function (file) {
                  var obj = {
                    type: file.type,
                    parent_id: doc._id,
                    parent_type: 'post',
                    author_id: doc.author._id
                  };
                  obj[file.type] = file;
                  switch (k) {
                    case 'image_full':
                    case 'image_full_gif':
                      _.extend(obj, {
                        thumbs: _.filter(files.image_thumb, function (img) {
                            return img.original_id === file.original_id;
                        })
                      });
                      break;
                    case 'video_encode_iphone':
                    case 'video_encode_ipad':
                    case 'video_encode_hd':
                      obj.quality = _s.strRightBack(k, '_');
                      _.extend(obj, {
                        poster: _.find(files['video_poster_' + obj.quality],
                            function (img) {
                          return img.original_id === file.original_id;
                        }),
                        thumbs: _.filter(files.video_thumbs, function (img) {
                          return img.original_id === file.original_id;
                        })
                      });
                      break;
                    case 'audio_encode': _.extend(obj, {}); break;
                  }
                  objs.push(obj);
                });
              });
              this();
            },
            function (err) {
              if (errorHandler(err, req, res)) return;

              // Skip creating media if there are no files.
              if (files.length === 0) {
                return this();
              }
              var group = this.group();

              // Create media docs from objects.
              _.each(objs, function (props) {
                db.Medias.create(props, group());
              });
            },
            function (err, medias) {
              if (errorHandler(err, req, res)) return;

              // Add medias to post.
              doc.medias = medias || [];

              // Event props.
              var event = {
                actor_id: req.user._id,
                target_id: parent ? parent._id: null,
                action_id: doc._id,
                action_type: 'post',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    v: req.user.avatar,
                    t: 'post',
                    b: _s.prune(doc.body, 40),
                    n: doc.title,
                    s: doc.key
                  }
                },
                public: doc.public
              };
              if (parent) {
                event.data.target = {
                  t: type,
                  i: parent._id.toString()
                };
                switch (type) {
                  case 'member':
                    event.data.target.i = parent._id.toString();
                    event.data.target.u = parent.username;
                    event.data.target.a = parent.displayName;
                    event.data.target.g =
                        iutil.hash(parent.primaryEmail || 'foo@bar.baz');
                    event.data.target.v =
                        parent.avatar ? parent.avatar.ssl_url: undefined;
                    break;
                  case 'crag':
                    event.data.target.n =
                        [parent.name, parent.country].join(', ');
                    event.data.target.s = ['crags', parent.key].join('/');
                    break;
                  case 'ascent':
                    event.data.target.n =
                        [parent.name, parent.crag, parent.country].join(', ');
                    event.data.target.s = ['crags', parent.key].join('/');
                    break;
                }
              }

              events.publish('post', 'post.new', {data: doc, event: event});
              events.subscribe(req.user, doc, {style: 'watch', type: 'post'});

              // Mentions
              _.each(mentionDocs, function(mem) {
                if (!mem) return;
                var meta = {
                  style: 'mention',
                  type: 'post',
                  mentioner: req.user,
                  target: parent ? event.data.target : event.data.action
                };
                events.subscribe(mem, doc, meta);
              });

              res.send({posted: true, id: doc._id});

              if (facebook) {
                sharing.postToFacebook(req.user, doc.key);
              }
              if (twitter) {
                var txt = doc.title ? doc.title + ': ' + doc.body: doc.body;
                sharing.tweet(req.user, doc.key, txt);
              }
            }
          );

        });
      }
    );
  });

  // Update (TODO)
  app.put('/api/posts/:id', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }
    res.send();
  });

  // Delete
  app.delete('/api/posts/:un/:k', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    // Get the post.
    var key = [req.params.un, req.params.k].join('/');
    db.Posts.read({key: key}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'post')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.status(403).send({error: 'Member invalid'});
      }

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (errorHandler(err, req, res, event, 'event')) return;

        Step(
          function () {

            // Remove notifications for events where post is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, es) {
              if (es.length === 0) {
                return this();
              }
              var _this = _.after(es.length, this);
              _.each(es, function (e) {

                // Publish removed status.
                events.publish('event', 'event.removed', {data: e});

                db.Notifications.list({event_id: e._id}, function (err, notes) {

                  // Publish removed statuses.
                  _.each(notes, function (note) {
                    events.publish('mem-' + note.subscriber_id.toString(),
                        'notification.removed',
                        {data: {id: note._id.toString()}});
                  });
                  db.Notifications.remove({event_id: e._id}, _this);
                });
              });
            }, this));
          },
          function (err) {
            if (err) return this(err);

            // Remove content on post.
            db.Medias.remove({parent_id: doc._id}, this.parallel());
            db.Comments.remove({parent_id: doc._id}, this.parallel());
            db.Hangtens.remove({parent_id: doc._id}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove(
                {$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());

            // Finally, remove the post.
            db.Posts.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Publish removed status.
            events.publish('event', 'event.removed', {data: event});
            events.publish('post', 'post.removed',
                {data: {id: doc._id.toString()}});

            res.send({removed: true});
          }
        );

      });
    });
  });

  // Search
  app.post('/api/posts/search/:s', function (req, res) {

    // Perform the search.
    cache.search('posts', req.params.s, 20, function (err, ids) {
      if (errorHandler(err, req, res)) return;

      Step(
        function () {
          ids = _.map(ids, function(i) { return i.split('::')[1]; });

          // Check results.
          if (!ids || ids.length === 0) {
            return this();
          }

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching posts.
          db.Posts.list({_id: {$in: _ids}}, {sort: {created: 1}, limit: 50,
              inflate: {author: profiles.member}}, this);
        },
        function (err, posts) {
          if (errorHandler(err, req, res)) return;

          // Send profile.
          res.send(iutil.client({items: posts || []}));
        }
      );
    }, 'or');
  });

  // Watch
  app.post('/api/posts/:id/watch', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    // Find doc.
    db.Posts.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'post')) return;

      // Create subscription.
      events.subscribe(req.user, doc, {style: 'watch', type: 'post'},
          function (err) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({watched: true});
      });
    });
  });

  // Unwatch
  app.post('/api/posts/:id/unwatch', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    // Find doc.
    db.Posts.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'post')) return;

      // Remove subscription.
      events.unsubscribe(req.user, doc, function (err) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({unwatched: true});
      });
    });
  });

  return exports;
};
