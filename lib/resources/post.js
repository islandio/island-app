/*
 * post.js: Handling for the post resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var request = require('request');
var qs = require('querystring');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var twitter = require('twitter-text');
var db = require('../db.js');
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

/*
 * Custom error for sharing failures.
 */
var ShareError = function (msg, constr) {
  Error.captureStackTrace(this, constr || this);
  this.message = msg || 'Error';
}
util.inherits(ShareError, Error);
ShareError.prototype.name = 'Share Error';

/*
 * Post to Facebook.
 */
function postToFacebook(post, keys, cb) {

  // Grab content.
  var videos = _.filter(post.medias, function (media) {
    return media.type === 'video';
  });
  var audios = _.filter(post.medias, function (media) {
    return media.type === 'audio';
  });
  var images = _.filter(post.medias, function (media) {
    return media.type === 'image';
  });

  // Make a caption.
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
  
  // Setup post params.
  var params = {
    link: 'http://island.io' + '/' + post.key,
    app_id: keys.clientID,
    access_token: post.author.facebookToken
  };
  if (caption !== '') {
    params.caption = caption;
    params.name = post.author.displayName;
    if (post.title !== '')
      params.name += ' / ' + post.title;
    params.description =  post.body;
    params.picture = images.length > 0 ? images[0].image.cf_url:
      (videos.length > 0 ? videos[0].image.cf_url : null);
  } else {
    if (post.title !== '') {
      params.name = post.author.displayName + ' / ' + post.title;
      params.description =  post.body;
    } else {
      params.message = post.body + ' - ' + params.link;
      delete params.link;
    }
  }

  // Send to Facebook.
  request.post({
    uri: ['https://graph.facebook.com', post.author.facebookId,
        'feed'].join('/'),
    qs: params,
    json: true
  }, function (err, res, body) {
    if (err) return cb(err);
    if (body.error) return cb(new ShareError(JSON.stringify(body)));
    cb();
  });

}

/*
 * Determine if member has usable Twitter credentials.
 */
function verifyTwitterCredentials(keys, member, cb) {

  // Call up Twitter.
  request.get({
    uri: 'https://api.twitter.com/1.1/account/verify_credentials.json', 
    oauth: {
      consumer_key: keys.consumerKey,
      consumer_secret: keys.consumerSecret,
      token: member.twitterToken,
      token_secret: member.twitterSecret
    }, 
    json: true
  }, function (err, req, body) {
    if (err) return cb(err);
    if (body.errors) return cb(new ShareError(JSON.stringify(body)));
    cb();
  });

}

/*
 * Make a Twitter tweet.
 */
function tweetToTwitter(post, keys, cb) {

  // Make sure we have good credentials.
  verifyTwitterCredentials(keys, post.author, function (err) {
    if (err) return cb(err);

    // Grab content.
    var videos = _.filter(post.medias, function (media) {
      return media.type === 'video';
    });
    var audios = _.filter(post.medias, function (media) {
      return media.type === 'audio';
    });
    var images = _.filter(post.medias, function (media) {
      return media.type === 'image';
    });

    // Make a caption.
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
      caption = caption.substr(0, comIndex) + ' and'
          + caption.substr(comIndex + 1);
    }

    // Write the tweet.
    var placeholder = '_%t_';
    var link = 'island.io/' + post.key;
    var status = placeholder + ' ' + link;
    if (caption !== '') status += ' ' + caption;
    var title = (post.title ? post.title + ': ' + post.body: post.body) || '';

    // Truncate the tweet.
    title = _.prune(title, 140 - status.length + placeholder.length);
    status = status.replace('_%t_', title);

    // Send to Twitter
    var uri = 'https://api.twitter.com/1.1/statuses/update.json?';
    var params = {status: status};
    uri += qs.stringify(params);
    uri = uri
        .replace(/\!/g, "%21")
        .replace(/\'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
    request.post({
      uri: uri, 
      oauth: {
        consumer_key: keys.consumerKey,
        consumer_secret: keys.consumerSecret,
        token: post.author.twitterToken,
        token_secret: post.author.twitterSecret
      }, 
      json: true
    }, function (err, req, body) {
      if (err) return cb(err);
      if (body.errors) return cb(new Error(JSON.stringify(body)));
      cb();
    });
  
  });

}

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {
  var cloudfront = app.get('cloudfront');
  var pubsub = app.get('pubsub');

  // List
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

  // Create
  app.post('/api/posts', function (req, res) {
    if (!req.body.assembly && (!req.body.body || req.body.body === ''))
      return res.send(403, {error: 'Post invalid'});

    if (!req.user || req.user.role !== 0)
      return res.send(403, {error: 'Member invalid'});

    // Req params
    var title = req.body.title;
    var body = req.body.body;
    var files = req.body.assembly ? req.body.assembly.results: {};
    var facebook = req.body.facebook;
    var twitter = req.body.twitter;

    // Attempt to use title slug for the url key.
    var key = title && title !== '' ? _.slugify(title): null;
    if (!key || key.length < 8 || key === req.user.username
        || key === req.user.instagram)
      key = com.key();

    // Document props.
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

      // This is new so need to fill comments.
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

          // Handle sharing.
          post.author = req.user;
          var failures = {};
          Step(
            function () {

              // Facebook...
              if (facebook)
                postToFacebook(post, app.get('facebook'), this);
              else this();

            },
            function (err) {
              if (err && err instanceof ShareError)
                pubsub.publish('flashes-' + post.author._id.toString(),
                    'flash.new', {
                  message: 'There was a problem sharing your post to Facebook. '
                      + 'Please <a href="/connect/facebook">'
                      + 're-connect your account</a> and try again.',
                  level: 'error',
                  sticky: true
                });
              else if (err) util.error(err);

              // Twitter sharing...
              if (twitter)
                tweetToTwitter(post, app.get('twitter'), this);
              else this();

            },
            function (err) {
              if (err && err instanceof ShareError) {
                util.error(err);
                pubsub.publish('flashes-' + post.author._id.toString(),
                    'flash.new', {
                  message: 'There was a problem sharing your post to Twitter. '
                      + 'Please <a href="/connect/twitter">'
                      + 're-connect your account</a> and try again.',
                  level: 'error',
                  sticky: true
                });
              }
              else if (err) util.error(err);
            }
          );

        }
      );
      
    });
  });

  // Read
  app.get('/api/posts/:k', function (req, res) {

    db.Posts.read({key: req.params.k}, function (err, doc) {
      if (com.error(err, req, res, doc, 'post')) return;
      res.send(doc);
    });

  });

  // Update
  app.put('/api/posts/:k', function (req, res) {

    // db.Posts.update({key: req.params.k}, {$set: req.body},
    //     function (err, stat) {
    //   if (com.error(err, req, res, stat, 'post')) return;
    //   res.send({updated: true});
    // });

  });

  // Delete
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
  return exports;
}
