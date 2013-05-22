/*
 * post.js: Handling for the post resource.
 *
 */

// Module Dependencies
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

    // Setup params.
    var files = req.body.assembly ? req.body.assembly.results: [];
    var facebook = req.body.facebook;
    var twitter = req.body.twitter;
    var props = {
      body: req.body.body,
      title: req.body.title,
      ccnt: 0,
      vcnt: 0,
      product: {
        sku: null,
        price: null,
        type: null,
        subtype: null,
      },
      key: com.key(),
      author_id: req.user._id
    };

    // Create the post.
    db.Posts.create(props, {inflate: {author: profiles.member}},
        function (err, post) {
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
                key: com.key(),
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

  // app.get('/:key', function (req, res) {
  //   Step(
  //     function () {
  //       memberDb.findPosts({key: req.params.key}, {limit: 1}, this);
  //     },
  //     function (err, post) {
  //       if (err || !post || post.length === 0)
  //         return res.render('404', { title: 'Not Found' });
  //       post = _.first(post);
  //       // record view
  //       memberDb.createView({
  //         post_id: post._id,
  //         member_id: req.user ? req.user._id: '_anonymous_',
  //       }, function (err, doc) {
  //         if (err) throw new Error('Failed to create view');
  //         else distributeUpdate('view', 'post', 'vcnt', doc.post_id);
  //       });
  //       // prepare document
  //       var img = [];
  //       var vid = [];
  //       var aud = [];
  //       _.each(post.medias, function (med) {
  //         var rating = req.user ? _.find(med.ratings, function (rat) {
  //           return req.user._id.toString() === rat.member_id.toString();
  //         }) : null;
  //         med.hearts = rating ? rating.val : 0;
  //         delete med.ratings;
  //         switch (med.type) {
  //           case 'image': img.push(med); break;
  //           case 'video': vid.push(med); break;
  //           case 'audio':
  //             aud.push(med);
  //             med.audioIndex = aud.length;
  //             break;
  //         }
  //       });
  //       post.medias = [].concat(img, aud, vid);
  //       res.render('single', {
  //         title: post.title,
  //         post: post,
  //         member: req.user,
  //         twitters: twitterHandles,
  //         util: templateUtil
  //       });
  //     }
  //   );
  // });

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

  // // Add media from Transloadit
  // app.put('/insert', authorize, function (req, res) {
  //   if (!req.body.post || !req.body.assembly
  //       || req.body.assembly.results.length === 0)
  //     return done(new Error('Failed to insert post'))
  //   var results = req.body.assembly.results;
  //   Step(
  //     function () {
  //       var post = req.body.post;
  //       post.member = req.user;
  //       memberDb.createPost(post, this);
  //     },
  //     function (err, doc) {
  //       if (err) return done(err);
  //       if (!doc) return done(new Error('Failed to create post'));
  //       eventDb.subscribe({
  //         member_id: req.user._id,
  //         post_id: doc._id,
  //         channel: channels.all + '-' + req.user.key,
  //       });
  //       var medias = [];
  //       _.each(results, function (val, key) {
  //         _.each(val, function (result) {
  //           var prefix;
  //           switch (_.words(key, '_')[0]) {
  //             case 'image': prefix = cloudfrontImageUrl; break;
  //             case 'video': prefix = cloudfrontVideoUrl; break;
  //             case 'audio': prefix = cloudfrontAudioUrl; break;
  //           }
  //           result.cf_url = prefix + result.id.substr(0, 2)
  //                           + '/' + result.id.substr(2)
  //                           + '.' + result.ext;
  //           if ('image_full' !== key && 'image_full_gif' !== key
  //               && 'video_encode' !== key
  //               && 'audio_encode' !== key) return;
  //           var media = {
  //             type: result.type,
  //             key: doc.key,
  //             post_id: doc._id,
  //             member_id: req.user._id,
  //           };
  //           media[result.type] = result;
  //           switch (key) {
  //             case 'image_full':
  //             case 'image_full_gif':
  //               _.extend(media, {
  //                 thumbs: _.filter(results.image_thumb, function (img) {
  //                           return img.original_id === result.original_id; }),
  //               });
  //               break;
  //             case 'video_encode':
  //               _.extend(media, {
  //                 image: _.find(results.video_placeholder, function (img) {
  //                           return img.original_id === result.original_id; }),
  //                 poster: _.find(results.video_poster, function (img) {
  //                           return img.original_id === result.original_id; }),
  //                 thumbs: _.filter(results.video_thumbs, function (img) {
  //                           return img.original_id === result.original_id; }),
  //               });
  //               break;
  //             case 'audio_encode':
  //               _.extend(media, {});
  //               break;
  //           }
  //           medias.push(media);
  //         });
  //       });
  //       var _done = _.after(medias.length, done);
  //       _.each(medias, function (media) {
  //         memberDb.createMedia(media, function (err, med) {
  //           if (err) return done(err);
  //           _done(null, doc._id);
  //         });
  //       });
  //     }
  //   );
  //   function done(err, docId) {
  //     if (err)
  //       return res.send({ status: 'error',
  //                       message: err.stack });
  //     distributeGrid(docId);
  //     if (req.body.post.toFacebook)
  //       memberDb.createFacebookPost(docId, function (err, data) {
  //         console.log('Facebook: ', err, data);
  //       });
  //     if (req.body.post.toTwitter)
  //       memberDb.createTweet(docId, function (err, data) {
  //         console.log('Twitter: ', err, data);
  //       });
  //     res.send({ status: 'success' });
  //   }
  // });

  // // Click media
  // app.put('/hit/:mediaId', function (req, res) {
  //   if (!req.params.mediaId)
  //     fail(new Error('Failed to hit media'));
  //   var props = {
  //     media_id: req.params.mediaId,
  //     member_id: req.user ? req.user._id: '_anonymous_',
  //   };
  //   memberDb.createHit(props, function (err, doc) {
  //     if (err) return fail(err);
  //     distributeUpdate('hit', 'media', 'tcnt', doc.media_id);
  //     res.send({ status: 'success' });
  //   });
  //   function fail(err) {
  //     res.send({ status: 'error',
  //              message: err.stack });
  //   }
  // });

  // // Publish updates from Instagram
  // app.post('/publish/instagram', function (req, res) {
  //   if (!req.body.length)
  //     return res.end();
  //   var instagramUserIds = _.chain(req.body).pluck('object_id')
  //                           .reject(function (i) {return !i; }).value();
  //   if (instagramUserIds.length === 0)
  //     return res.end();
  //   Step(
  //     function () {
  //       var group = this.group();
  //       _.each(instagramUserIds, function (id) {
  //         memberDb.collections.member.findOne({ instagramId: id }, group());
  //       });
  //     },
  //     function (err, members) {
  //       if (err) return done(err);
  //       if (!members || !members.length)
  //         return done(new Error('Cannot find members from Instagram update'));
  //       var group = this.group();
  //       _.each(members, function (mem) {
  //         getInstagram(mem, group());
  //       });
  //     },
  //     function (err, instagrams) {
  //       if (err) return done(err);
  //       if (!instagrams || !instagrams.length)
  //         return done(new Error('Cannot find data from Instagram update'));
  //       var group = this.group();
  //       instagrams = _.filter(instagrams, function (ins) {
  //         return _.include(ins.tags, 'island');
  //       });
  //       if (!instagrams.length)
  //         return done(null, []);
  //       _.each(instagrams, function (instagram) {
  //         instagramToPost(instagram, group());
  //       });
  //     },
  //     function (err, postIds) {
  //       if (err) return done(err);
  //       done(null, postIds);
  //     }
  //   );
  //   function getInstagram(member, cb) {
  //     request.get({
  //       uri: 'https://api.instagram.com/v1/users/'
  //             + member.instagramId + '/media/recent',
  //       qs: {
  //         count: 1,
  //         access_token: member.instagramToken
  //       }
  //     }, function (err, response, body) {
  //       if (err) return cb(err);
  //       var instagram;
  //       if (body) {
  //         body = JSON.parse(body);
  //         instagram = _.first(body.data);
  //         instagram.member = member;
  //       }
  //       cb(null, instagram);
  //     });
  //   }
  //   function instagramToPost(data, cb) {
  //     Step(
  //       function () {
  //         memberDb.createPost({
  //           title: '@' + data.user.username,
  //           body: data.caption ? data.caption.text : '',
  //           location: data.location,
  //           member: data.member,
  //         }, this);
  //       },
  //       function (err, doc) {
  //         if (err) return cb(err);
  //         if (!doc) return cb(new Error('Failed to create post'));
  //         eventDb.subscribe({
  //           member_id: data.member._id,
  //           post_id: doc._id,
  //           channel: channels.all + '-' + data.member.key,
  //         });
  //         var media = {
  //           type: 'image',
  //           key: doc.key,
  //           post_id: doc._id,
  //           member_id: data.member._id,
  //         };
  //         delete data.member;
  //         media.image = {
  //           url: data.images.standard_resolution.url,
  //           meta: {
  //             width: data.images.standard_resolution.width,
  //             height: data.images.standard_resolution.height,
  //           },
  //         };
  //         media.thumbs = [
  //           {
  //             url: data.images.low_resolution.url,
  //             meta: {
  //               width: data.images.low_resolution.width,
  //               height: data.images.low_resolution.height,
  //             },
  //           },
  //           {
  //             url: data.images.thumbnail.url,
  //             meta: {
  //               width: data.images.thumbnail.width,
  //               height: data.images.thumbnail.height,
  //             },
  //           }
  //         ];
  //         delete data.images;
  //         media.instagram = data;
  //         memberDb.createMedia(media, function (err, med) {
  //           cb(err, doc._id);
  //         });
  //       }
  //     );
  //   }
  //   function done(err, docIds) {
  //     if (err) {
  //       console.log(inspect(err));
  //       return res.end();
  //     }
  //     _.each(docIds, function (id) {
  //       distributeGrid(id);
  //     });
  //     res.end();
  //   }
  // });

  // app.get('/publish/instagram', function (req, res) {
  //   if (instagramVerifyToken !== req.query['hub.verify_token']
  //       || 'subscribe' !== req.query['hub.mode']
  //       || '' === req.query['hub.challenge']) {
  //     console.log('Instagram subscription challenge attempt failed');
  //     return res.end();
  //   }
  //   console.log('Instagram subscription challenge accepted');
  //   res.send(req.query['hub.challenge']);
  // });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
