/*
 * instagram.js: Handling for the instagram resource.
 * 
 * We want to let users post to their feed by mentioning in tagging their (not others!)
 * instagram photos with @island_io, #islandio, and #weareisland. Ideally,
 * this could be done by subscribing to each of those entities. However,
 * we cannot subscribe to @-tags directly, and we can only subscribe to #-tags
 * in such a way that makes reliably fetching the user behind the actual media
 * impossible. So, subscribing to media from authenticated users and then parsing
 * the cation for the tags is closest to what we want. This has the added benefit
 * of handling duplicates from different tags. The downside is we will only see
 * tags that were created in the inital post caption, not comments. We could make
 * that work for non-private instagram users (need to use client_id with tags
 * cause we cannot associate the member and use their auth_token) by listening
 * for the tag, grabbing only the latest post, and then checking to see if that
 * user (which we can't know 100% is actually the right user) is the post owner,
 * but doesn't seem hugely important for now.
 */

var request = require('request');
var qs = require('querystring');
var crypto = require('crypto');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');

var API_URL = 'https://api.instagram.com/v1';

// Do any initializations
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var events = app.get('events');
  var cache = app.get('cache');

  function _errorHandler(err, req, res) {
    if (err) {
      util.error(err);
      res.send(500, iutil.client(err.stack || err));
      return true;
    } else {
      return false;
    }
  }

  function _handleChallenge(req, res) {
    if (req.query && req.query['hub.challenge']
        && req.query['hub.verify_token'] === app.get('INSTAGRAM_VERIFY_TOKEN')) {
      res.send(req.query['hub.challenge']);
    } else {
      res.send(400, {error: 'Bad request'});
    }
  }

  function _validateRequest(req, res) {

    // Check sha1.
    var signature = crypto.createHmac('sha1', app.get('INSTAGRAM_CLIENT_SECRET'))
        .update(req.rawBody).digest('hex');
    if (signature !== req.headers['x-hub-signature']) {
      res.send(403, {error: 'Invalid request'});
      return false;
    }

    // Check body.
    if (!req.body || req.body.length === 0) {
      res.send();
      return false;
    }

    return true;
  }

  function _fillPostMember(p, cb) {
    db.Members.read({instagramId: p.object_id}, function (err, mem) {
      if (err) return cb(err);
      p.member = mem;
      cb();
    });
  }

  function _fillPostMedia(p, cb) {
    request.get({
      uri: API_URL + '/media/' + p.data.media_id
          + '?access_token=' + p.member.instagramToken,
      json: true
    }, function (err, res, body) {
      err = err || body.meta.error_message;
      if (err) return cb(err);
      p.media = body.data;
      cb();
    });
  }

  function _fillPostMediaFromTag(p, cb) { // not reliable under high volume
    request.get({
      uri: API_URL + '/tags/' + o.object_id + '/media/recent'
          + '?count=1&client_id=' + app.get('INSTAGRAM_CLIENT_ID'),
      json: true
    }, function (err, res, body) {
      err = err || body.meta.error_message;
      if (err) return cb(err);
      p.media = _.isArray(body.data) ? body.data[0]: undefined;
      cb();
    });
  }

  function _createPost(p, cb) {
    var body = '';
    if (p.media.caption && p.media.caption.text) {
      body += '@' + p.media.user.username + ' ';
      body += p.media.caption.text;
    }
    var key = iutil.createId_32();
    var props = {
      body: body,
      title: '',
      type: 'instagram',
      remote_media: p.media,
      product: {
        sku: null,
        price: null,
        type: null,
        subtype: null,
      },
      key: [p.member.username, key].join('/'),
      author_id: p.member._id,
      public: true
    };

    db.Posts.create(props, {inflate: {author: profiles.member},
        force: {key: 1}}, function (err, doc) {
      if (err) return cb(err);

      // This is new so no need to fill.
      doc.comments = [];
      doc.medias = [];

      // Event props.
      var event = {
        actor_id: p.member._id,
        target_id: null,
        action_id: doc._id,
        action_type: 'post',
        data: {
          action: {
            i: p.member._id.toString(),
            a: p.member.displayName,
            g: p.member.gravatar,
            v: p.member.avatar,
            t: 'post',
            b: _.prune(doc.body, 40),
            n: doc.title,
            s: doc.key
          }
        },
        public: doc.public
      };

      // Publish post.
      events.publish('post', 'post.new', {data: doc, event: event});

      // Subscribe actor to future events.
      events.subscribe(p.member, doc, {style: 'watch', type: 'post'});

      // Done.
      cb();
    });
  }

  function _isIslandPost(p) {
    var txt = p.media.caption ? p.media.caption.text: '';
    var isMentioned = txt.indexOf('@' + app.get('INSTAGRAM_USER')) !== -1;
    var isTagged = _.find(p.media.users_in_photo || [], function (u) {
      return u.user.username === app.get('INSTAGRAM_USER');
    });
    var isHashTagged = !!_.find(app.get('INSTAGRAM_TAGS').split(':'), function (tag) {
      return txt.indexOf('#' + tag) !== -1;
    });
    return isMentioned || isTagged || isHashTagged;
  }

  // User subscription challenge callback.
  app.get('/api/instagrams/users', _handleChallenge);

  // Tag subscription challenge callback.
  app.get('/api/instagrams/tags', _handleChallenge);

  // User subscription results come here.
  app.post('/api/instagrams/users', function (req, res) {
    if (!_validateRequest(req, res)) {
      return;
    }

    var posts = req.body;

    Step(
      function () {
        _.each(posts, _.bind(function (p) {
          _fillPostMember(p, this.parallel());
        }, this));
      },
      function (err) {
        if (err) return this(err);
        posts = _.reject(posts, function (p) {
          return !p.member;
        });
        if (posts.length === 0) {
          return this();
        }
        _.each(posts, _.bind(function (p) {
          _fillPostMedia(p, this.parallel());
        }, this));
      },
      function (err) {
        if (err) return this(err);
        posts = _.reject(posts, function (p) {
          return !p.media || !_isIslandPost(p);
        });
        if (posts.length === 0) {
          return this();
        }
        _.each(posts, _.bind(function (p) {
          _createPost(p, this.parallel());
        }, this));
      },
      function (err) {
        if (_errorHandler(err, req, res)) return;
        res.send();
      }
    );
  });

  // Tag subscription results come here.
  // NOTE: NOT IN USE
  app.post('/api/instagrams/tags', function (req, res) {
    if (!_validateRequest(req, res)) {
      return;
    }

    var posts = req.body;

    res.send();
  });

  return exports;
}
