/*
 * post.js: Handling for the post resource.
 *
 */

// Module Dependencies
var request = require('request');
var qs = require('querystring');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
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
  if (videos.length > 0) {
    caption += videos.length + ' video';
  }
  if (videos.length > 1) {
    caption += 's';
  }
  if (audios.length > 0) {
    if (caption.length > 0) {
      caption += ' | ';
    }
    caption += audios.length + ' sound';
  } if (audios.length > 1) {
    caption += 's';
  }
  if (images.length > 0) {
    if (caption.length > 0) {
      caption += ' | ';
    }
    caption += images.length + ' photo';
  } if (images.length > 1) {
    caption += 's';
  }

  return {videos: videos, audios: audios, images: images, caption: caption};
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
    params.picture = parsed.images.length > 0 ?
        (parsed.images[0].image.ssl_url || parsed.images[0].image.url):
        (parsed.videos.length > 0 ? parsed.videos[0].image.ssl_url : null);
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
  return this.routes();
}

// Define routes.
exports.routes = function (app) {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var cache = app.get('cache');

  // Create
  app.post('/api/posts', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    if (!req.body.assembly && (!req.body.body || req.body.body === '')) {
      return res.send(403, {error: 'Post invalid'});
    }

    // Get post type.
    var type = req.body.type;
    var typeResource = type ? _.capitalize(type) + 's': false;

    // Params
    var title = req.body.title;
    var body = req.body.body;
    var files = req.body.assembly ? req.body.assembly.results: {};
    var facebook = req.body.facebook;
    var twitter = req.body.twitter;

    // Attempt to use title slug for the url key.
    var key = title && title !== '' ? _.slugify(title): null;
    if (!key || key.length < 8 || key === req.user.username
        || key === req.user.instagram) {
      key = iutil.createId_32();
    }

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
    if (type && req.body.parent_id) {
      props.parent_id = db.oid(req.body.parent_id);
    }

    // Add type.
    if (_.isEmpty(files)) {
      delete props.type;
    } else {
      _.each(files, function (v, k) {
        _.each(v, function (file) {
          if (file.type === 'video')
            props.type = 'video';
        });
      });
    }
    // Check for video link.
    if (iutil.parseVideoURL(props.body)) {
      props.type = 'video';
    }

    Step(
      function () {
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

        // Create the post.
        db.Posts.create(props, {inflate: {author: profiles.member},
            force: {key: 1}}, function (err, doc) {
          if (errorHandler(err, req, res)) return;

          // Index this post.
          cache.index('posts', doc, ['title'], null);

          // This is new so no need to fill comments.
          doc.comments = [];

          var objs = [];
          Step(
            function () {

              // Build media objects from the files.
              _.each(files, function (v, k) {
                if (k !== 'image_full'
                    && k !== 'image_full_gif'
                    && k !== 'video_encode_iphone'
                    && k !== 'video_encode_ipad'
                    && k !== 'video_encode_hd'
                    && k !== 'audio_encode') {
                  return;
                }
                _.each(v, function (file) {
                  var obj = {
                    type: file.type,
                    parent_id: doc._id,
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
                      obj.quality = _.strRightBack(k, '_');
                      _.extend(obj, {
                        poster: _.find(files['video_poster_' + obj.quality], function (img) {
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
                    t: 'post',
                    b: _.prune(doc.body, 40),
                    n: doc.title,
                    s: doc.key
                  }
                }
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
                    event.data.target.g = iutil.hash(parent.primaryEmail || 'foo@bar.baz');
                    break;
                  case 'crag':
                    event.data.target.n = [parent.name, parent.country].join(', '),
                    event.data.target.s = ['crags', parent.key].join('/');
                    break;
                  case 'ascent':
                    event.data.target.n =
                        [parent.name, parent.crag, parent.country].join(', '),
                    event.data.target.s = ['crags', parent.key].join('/');
                    break;
                }
              }

              // Publish post.
              events.publish('post', 'post.new', {data: doc, event: event});

              // Subscribe actor to future events.
              events.subscribe(req.user, doc, {style: 'watch', type: 'post'});

              // Done.
              res.send({posted: true});

              // Handle sharing.
              doc.author = req.user;

              // Handle Facebook.
              // if (facebook) {
              //   postToFacebook(doc, {
              //     name: app.get('FACEBOOK_NAME'),
              //     clientID: app.get('FACEBOOK_CLIENT_ID'),
              //     clientSecret: app.get('FACEBOOK_CLIENT_SECRET')
              //   }, function (err) {
              //     if (err && err instanceof ShareError) {
              //       util.error(req.user.username + ': '
              //           + JSON.stringify(err.message));
              //       var message = err.message.code === 190 ? 
              //           'There was a problem sharing your post to Facebook. '
              //           + 'Please <a href="/connect/facebook">'
              //           + 're-connect your account</a> and try again.':
              //           'Facebook error: ' + err.message.message;
              //       events.publish('mem-' + doc.author._id.toString(), 'flash.new', {
              //         data: {
              //           message: message,
              //           level: 'error',
              //           sticky: true
              //         }
              //       });
              //     } else if (err) util.error(err);
              //   });
              // }

              // Handle Twitter.
              // if (twitter) {
              //   tweetToTwitter(doc, {
              //     consumerKey: app.get('TWITTER_CONSUMER_KEY'),
              //     consumerSecret: app.get('TWITTER_CONSUMER_SECRET')
              //   }, function (err) {
              //     if (err && err instanceof ShareError) {
              //       util.error(req.user.username + ': '
              //           + JSON.stringify(err.message));
              //       if (err.message.code === 89)
              //         events.publish('mem-' + doc.author._id.toString(), 'flash.new', {
              //           data: {
              //             message: 'There was a problem sharing your post to Twitter. '
              //                 + 'Please <a href="/connect/twitter">'
              //                 + 're-connect your account</a> and try again.',
              //             level: 'error',
              //             sticky: true
              //           }
              //         });
              //     } else if (err) util.error(err);
              //   });
              // }
            }
          );
          
        });
      }
    );
  });

  // Update (TODO)
  app.put('/api/posts/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    res.send();
  });

  // Delete
  app.delete('/api/posts/:un/:k', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the post.
    var key = [req.params.un, req.params.k].join('/');
    db.Posts.read({key: key}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'post')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: 'Member invalid'});
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
                        'notification.removed', {data: {id: note._id.toString()}});
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
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());

            // Finally, remove the post.
            db.Posts.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Publish removed status.
            events.publish('event', 'event.removed', {data: event});
            events.publish('post', 'post.removed', {data: {id: doc._id.toString()}});

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

  return exports;
}
