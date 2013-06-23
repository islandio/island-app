/*
 * post.js: Handling for the post resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var request = require('request');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db.js');
var authorize = require('./member.js').authorize;
var com = require('../common.js');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "title": <String>,
    "body": <String>,
    "ccnt": <Number>,
    "vcnt": <Number>,
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

// Do any initializations
exports.init = function (app) {

  // Create service subscriptions
  // request.post({
  //   uri: 'https://api.instagram.com/v1/subscriptions',
  //   form: {
  //     client_id: app.get('instagram').clientID,
  //     client_secret: app.get('instagram').clientSecret,
  //     object: 'user',
  //     aspect: 'media',
  //     verify_token: app.get('instagram').verifyToken,
  //     callback_url: app.get('instagram').postCallbackURL
  //   }
  // }, function (err, res, body) {
  //   if (err)
  //     return util.error(inspect(err));
  //   body = JSON.parse(body);
  //   if (res.statusCode !== 200)
  //     return util.log('Instagram subscription failed: "'
  //         + body.meta.error_message + '"');
  //   util.log('Subscribed to connected Instagram users (id '
  //       + body.data.id + ')');
  // });

  return exports;
}

// Define routes.
exports.routes = function (app) {
  var cloudfront = app.get('cloudfront');
  var pubsub = app.get('pubsub');

  // list
  app.post('/api/posts/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);

    db.Posts.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, posts) {
      if (com.error(err, req, res)) return;

      Step(
        function () {

          // Fill posts.
          db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
              this.parallel());
          db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
              inflate: {author: profiles.member}},
              this.parallel());
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({
            posts: {
              cursor: ++cursor,
              more: posts && posts.length === limit,
              items: posts,
              query: query,
            }
          }));
        }
      );

    });

  });

  // create
  app.post('/api/posts', function (req, res) {
    if (!req.body.assembly && (!req.body.body || req.body.body === ''))
      return res.send(403, {error: 'Post invalid'});

    if (!req.user || !req.user.confirmed || req.user.role !== 0)
      return res.send(403, {error: 'Member invalid'});

    // Req params
    var title = req.body.title;
    var body = req.body.body;
    var files = req.body.assembly ? req.body.assembly.results: [];
    var facebook = req.body.facebook;
    var twitter = req.body.twitter;

    // Attempt to use title slug for the url key.
    var key = title && title !== '' ? _.slugify(title): null;
    if (!key || key.length < 8 || key === req.user.username
        || key === req.user.instagram)
      key = com.key();

    // Document props
    var props = {
      body: body,
      title: title,
      ccnt: 0,
      vcnt: 0,
      product: {
        sku: null,
        price: null,
        type: null,
        subtype: null,
      },
      key: [req.user.username, key].join('/'),
      author_id: req.user._id
    };

    // Create the post.
    db.Posts.create(props, {inflate: {author: profiles.member},
        force: {key: 1}}, function (err, post) {
      if (com.error(err, req, res)) return;

      // This is new so no need to fill comments.
      post.comments = [];

      var objs = [];
      Step(
        function () {

          // Build media objects from the files.
          _.each(files, function (v, k) {
            _.each(v, function (file) {
              var pre;
              switch (_.words(k, '_')[0]) {
                case 'image': pre = cloudfront.img; break;
                case 'video': pre = cloudfront.vid; break;
                case 'audio': pre = cloudfront.aud; break;
              }
              file.cf_url = pre + file.id.substr(0, 2) + '/'
                  + file.id.substr(2) + '.' + file.ext;
              if (k !== 'image_full' && k !== 'image_full_gif'
                  && k !== 'video_encode' && k !== 'audio_encode') return;
              var obj = {
                type: file.type,
                parent_id: post._id,
                author_id: post.author._id
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
                case 'video_encode':
                  _.extend(obj, {
                    image: _.find(files.video_placeholder, function (img) {
                        return img.original_id === file.original_id;
                    }),
                    poster: _.find(files.video_poster, function (img) {
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
          if (com.error(err, req, res)) return;

          // Skip creating media if there are no files.
          if (files.length === 0) return this();
          var group = this.group();

          // Create media docs from objects.
          _.each(objs, function (props) {
            db.Medias.create(props, group());
          });
        },
        function (err, medias) {
          if (com.error(err, req, res)) return;

          // Add medias to post.
          post.medias = medias;

          // TODO: Notify subscribers (followers) of event.

          // Subscribe actor to future events.
          pubsub.subscribe(req.user, post, {style: 'watch', type: 'post'});

          // Publish post.
          pubsub.publish('posts', 'post.new', post);

          // TODO: Make client optimistic so only need to send id here.
          res.send(com.client({post: post}));
        }
      );
      
    });
  });

  // read
  app.get('/api/posts/:k', function (req, res) {

    db.Posts.read({key: req.params.k}, function (err, doc) {
      if (com.error(err, req, res, doc, 'post')) return;
      res.send(doc);
    });

  });

  // update
  app.put('/api/posts/:k', function (req, res) {

    // db.Posts.update({key: req.params.k}, {$set: req.body},
    //     function (err, stat) {
    //   if (com.error(err, req, res, stat, 'post')) return;
    //   res.send({updated: true});
    // });

  });

  // delete
  app.delete('/api/posts/:k', function (req, res) {

    db.Posts.read({key: req.params.k}, function (err, doc) {
      if (com.error(err, req, res, doc, 'post')) return;

      db.Medias.list({parent_id: doc._id}, function (err, docs) {
        if (com.error(err, req, res)) return;

        Step(
          function () {
            db.Posts.delete({_id: doc._id}, this.parallel());
            _.each(docs, _.bind(function (doc) {
              db.Medias.delete({_id: doc._id}, this.parallel());
              db.Hits.delete({media_id: doc._id}, this.parallel());
            }, this));
            db.Views.delete({parent_id: doc._id}, this.parallel());
            db.Comments.delete({parent_id: doc._id}, this.parallel());
            db.Subscriptions.delete({subscribee_id: doc._id}, this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;
            res.send({deleted: true});      
          }
        );

      });
    });

  });

  // // Media search
  // app.get('/search/:query', function (req, res) {
  //   var fn = '__clear__' === req.params.query ?
  //             _.bind(getGrid, {}, {}) :
  //             _.bind(memberDb.searchPosts, memberDb,
  //                   req.params.query);
  //   fn(function (err, docs) {
  //     if (err) return fail(err);
  //     Step(
  //       function () {
  //         var group = this.group();
  //         _.each(docs, function (doc) {
  //           renderMedia(doc, group());
  //         });
  //       },
  //       function (err, results) {
  //         if (err) return fail(err);
  //         res.send({ status: 'success',
  //                  data: { results: results } });
  //       }
  //     );
  //   });
  //   function fail(err) {
  //     res.send({ status: 'error',
  //              message: err.stack });
  //   }
  // });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {

  function instagrams() {

    // Format strings for SQL.
    function clean(str) { return str.replace(/'/g, "''"); }

    // Get all members that have an instagram handle.
    db.Members.list({instagramId: {$exists: true}}, function (err, members) {
      if (err) return util.error(err);
      if (members.length === 0) return;
      var now = Math.floor(Date.now() / 1000) - 60;

      Step(
        function () {
          var group = this.group();

          // Get the members' recent Instagrams.
          _.each(members, function (m) {
            (function fetch(cb) {
              request.get({
                uri: 'https://api.instagram.com/v1/users/' + m.instagramId
                    + '/media/recent',
                qs: {
                  access_token: m.instagramToken,
                  min_timestamp: now
                }
              }, function (err, response, body) {
                if (err) return cb(err);
                if (response.statusCode !== 200)
                  return cb(body);
                cb(null, _.map(JSON.parse(body).data, function (g) {
                  g.mid = m._id.toString();
                  return g;
                }));
              });
            })(group());
          });

        },
        function (err, grams) {
          if (err || !grams || grams.length === 0) return this();

          // Filter the instagrams for the correct tag(s).
          grams = _.filter(_.flatten(grams), function (g) {
              return _.include(g.tags, 'island'); });
          if (grams.length === 0) return this();
          util.log('Got ' + grams.length + ' Instagram(s)');

          // Map the images to CartoDB.
          var names = ["the_geom", "id", "mid", "handle",
              "caption", "uri", "turi"];
          var query = "INSERT INTO instagrams ("
              + _.join(",", names) + ") VALUES ";
          _.each(grams, function (g, i) {
            query += "(" + _.join(",", [g.location.latitude 
                && g.location.longitude ?
                "CDB_LatLng(" + g.location.latitude + ","
                + g.location.longitude + ")": "NULL",
                "'" + g.id + "'", "'" + g.mid + "'",
                "'" + g.user.username + "'",
                g.caption ? "'" + clean(g.caption.text) + "'": 'NULL',
                "'" + g.images.standard_resolution.url + "'",
                "'" + g.images.thumbnail.url + "'"]) + ")";
            if (i !== grams.length - 1) query += ", ";
          });

          // Call up the CartoDB API.
          curl.request({
            url: 'https://' + app.get('cartodb').user
                + '.cartodb.com/api/v2/sql',
            method: 'POST',
            data: {q: query, api_key: app.get('cartodb').api_key}
          }, this);
          
        },
        function (err, data) {
          if (err) return util.error(err);
          if (data) {
            data = JSON.parse(data);
            if (data.error) return util.error(data.error);
            util.log('Mapped Instagram(s)');
          }
        }
      );

    });

  };

  // Run instagram check every minute.
  new Job('1 * * * * *', instagrams, function () {}, true,
      'America/Los_Angeles');
  instagrams();

  return exports;
}
