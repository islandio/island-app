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
var db = require('../db.js');
var com = require('../common.js');
var profiles = require('../resources').profiles;


/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "type": <String>,
    "title": <String>,
    "body": <String>,
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
 * Parse post for sharing.
 */
function parsePost(post) {

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

  return {videos: videos, audios: audios,
        images: images, caption: caption};
}

/*
 * Post to Facebook.
 */
function postToFacebook(post, keys, cb) {

  // Setup post params.
  var parsed = parsePost(post);
  var params = {
    link: 'http://www.island.io' + '/' + post.key,
    app_id: keys.clientID,
    access_token: post.author.facebookToken
  };
  if (parsed.caption !== '') {
    params.caption = parsed.caption;
    params.name = post.author.displayName;
    if (post.title !== '')
      params.name += ' / ' + post.title;
    params.description =  post.body;
    params.picture = parsed.images.length > 0 ? parsed.images[0].image.cf_url:
      (parsed.videos.length > 0 ? parsed.videos[0].image.cf_url : null);
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
    if (body.error) {
      var e = body.error;
      e.from = 'facebook';
      return cb(new ShareError(e));
    }
    cb();
  });

}

/*
 * Make a Twitter tweet.
 */
function tweetToTwitter(post, keys, cb) {

  // Setup tweet params.
  var parsed = parsePost(post);
  var coms = parsed.caption.match(/,/g);
  if (coms) {
    var comIndex = coms.length > 1 ?
        parsed.caption.lastIndexOf(',') : parsed.caption.indexOf(',');
    parsed.caption = parsed.caption.substr(0, comIndex) + ' and'
        + parsed.caption.substr(comIndex + 1);
  }

  // Write the tweet.
  var placeholder = '_%t_';
  var link = 'www.island.io/' + post.key;
  var status = placeholder + ' ' + link;
  if (parsed.caption !== '') status += ' ' + parsed.caption;
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
    if (body.errors) {
      var e = {from: 'twitter', msg: body.errors[0].message,
          code: body.errors[0].code};
      return cb(new ShareError(e));
    }
    cb();
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
  var search = app.get('reds').createSearch('posts');

  // List
  app.post('/api/posts/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);

    db.Posts.list(query, {sort: {created: -1}, limit: limit, inc: true,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, posts) {
      if (com.error(err, req, res)) return;

      Step(
        function () {

          // Fill posts.
          db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
              this.parallel());
          db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
              limit: 5, reverse: true, inflate: {author: profiles.member}},
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
      type: 'image',
      product: {
        sku: null,
        price: null,
        type: null,
        subtype: null,
      },
      key: [req.user.username, key].join('/'),
      author_id: req.user._id
    };

    // Add type.
    _.each(files, function (v, k) {
      _.each(v, function (file) {
        if (file.type === 'video')
          props.type = 'video';
      });
    });

    // Create the post.
    db.Posts.create(props, {inflate: {author: profiles.member},
        force: {key: 1}}, function (err, post) {
      if (com.error(err, req, res)) return;

      // Index this post.
      if (post.title && post.title !== '' && post.title.match(/\w+/g))
        search.index(post.title, post._id.toString());

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

          // Inc author post count.
          db.Members._update({_id: req.user._id}, {$inc: {pcnt: 1}}, function (err) {
            if (err) util.error(err);
          });

          // TODO: Make client optimistic so only need to send id here.
          res.send(com.client({post: post}));

          // Handle sharing.
          post.author = req.user;

          // Facebook...
          if (facebook)
            postToFacebook(post, app.get('facebook'), function (err) {
              if (err && err instanceof ShareError) {
                util.error(req.user.username + ': '
                    + JSON.stringify(err.message));
                var message = err.message.code === 190 ? 
                    'There was a problem sharing your post to Facebook. '
                    + 'Please <a href="/connect/facebook">'
                    + 're-connect your account</a> and try again.':
                    'Facebook error: ' + err.message.message;
                pubsub.publish('mem-' + post.author._id.toString(),
                    'flash.new', {
                  message: message,
                  level: 'error',
                  sticky: true
                });
              } else if (err) util.error(err);
            });

          // Twitter...
          if (twitter)
            tweetToTwitter(post, app.get('twitter'), function (err) {
              if (err && err instanceof ShareError) {
                util.error(req.user.username + ': '
                    + JSON.stringify(err.message));
                if (err.message.code === 89)
                  pubsub.publish('mem-' + post.author._id.toString(),
                      'flash.new', {
                    message: 'There was a problem sharing your post to Twitter. '
                        + 'Please <a href="/connect/twitter">'
                        + 're-connect your account</a> and try again.',
                    level: 'error',
                    sticky: true
                  });
              } else if (err) util.error(err);
            });
        }
      );
      
    });
  });

  // Read
  app.get('/api/posts/:un/:k', function (req, res) {

    // Get the post.
    var key = [req.params.un, req.params.k].join('/');
    db.Posts.read({key: key}, function (err, doc) {
      if (com.error(err, req, res, doc, 'post')) return;
      res.send(doc);
    });

  });

  // Update (TODO)
  app.put('/api/posts/:un/:k', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    
    var key = [req.params.un, req.params.k].join('/');
    res.send();

  });

  // Delete
  app.delete('/api/posts/:un/:k', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the post.
    var key = [req.params.un, req.params.k].join('/');
    db.Posts.read({key: key}, function (err, doc) {
      if (com.error(err, req, res, doc, 'post')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'Member invalid'});

      Step(
        function () {
          var next = this;

          // Remove notifications for events where post is target.
          db.Events.list({target_id: doc._id}, function (err, events) {
            if (events.length === 0) return next();
            var _next = _.after(events.length, next);
            _.each(events, function (e) {
              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {id: note._id.toString()});
                });
              });
              db.Notifications.remove({event_id: e._id}, _next);
            });
          });
        },
        function (err) {
          if (err) return this(err);

          // Remove content on post.
          db.Comments.remove({parent_id: doc._id}, this.parallel());
          db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
          db.Events.remove({target_id: doc._id}, this.parallel());

          // Finally, remove the post.
          db.Posts.remove({_id: doc._id}, this.parallel());

          // De-inc author post count.
          db.Members._update({_id: doc.author_id}, {$inc: {pcnt: -1}}, this.parallel());

        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('posts', 'post.removed', {id: doc._id.toString()});

          res.send({removed: true});
        }
      );
    
    });

  });

  // Search
  app.post('/api/posts/search/:s', function (req, res) {

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {

      Step(
        function () {

          // Check results.
          if (ids.length === 0) return this();

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching posts.
          db.Posts.list({_id: {$in: _ids}}, {sort: {created: -1}, limit: 20,
              inflate: {author: profiles.member}}, this);

        },
        function (err, posts) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({items: posts || []}));

        }
      );
      
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
