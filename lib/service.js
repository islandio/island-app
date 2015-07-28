/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var request = require('request');
var url = require('url');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var MobileDetect = require('mobile-detect');
var fs = require('fs');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var dateFormat = require('dateformat');
var twitter = require('twitter-text');
var Client = require('./client').Client;
var Events = require('./resources/event');
var Crags = require('./resources/crag');
var collections = require('island-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../app');
var lib8a = require('island-lib8a');
var lib27crags = require('island-lib27crags');
var GradeConverter = new require('../public/js/GradeConverter').GradeConverter;

var gradeConverter = {
  'b': new GradeConverter('boulders').from('font').to('default'),
  'r': new GradeConverter('routes').from('french').to('default')
};

// Client-side templates rendered as static pages on server. These
// are cached in memory for speed
var splash_static = fs.readFileSync('public/templates/splash.html', 'utf8');
var map_css_static = fs.readFileSync('public/templates/carto/crags.css', 'utf8');

/*
 * Return transloadit params.
 */
var transloadit = exports.transloadit = function (req) {
  return req.user ? {
    media: {
      template_id: app.get('TRANSLOADIT_MEDIA_TEMPLATE_ID'),
      auth: {
        key: app.get('TRANSLOADIT_MEDIA_AUTH_KEY')
      }
    },
    profile: {
      template_id: app.get('TRANSLOADIT_PROFILE_TEMPLATE_ID'),
      auth: {
        key: app.get('TRANSLOADIT_PROFILE_AUTH_KEY')
      }
    },
    avatar_full: {
      template_id: app.get('TRANSLOADIT_AVATAR_FULL_TEMPLATE_ID'),
      auth: {
        key: app.get('TRANSLOADIT_AVATAR_FULL_AUTH_KEY')
      }
    },
    avatar: {
      template_id: app.get('TRANSLOADIT_AVATAR_TEMPLATE_ID'),
      auth: {
        key: app.get('TRANSLOADIT_AVATAR_AUTH_KEY')
      }
    }
  }: {};
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var events = app.get('events');
  var poet = app.get('poet');
  var errorHandler = app.get('errorHandler');

  /*
   * HTTP request handler.
   */
  function handler(sfn, template, inviteRequired, req, res) {
    if (!_.isBoolean(inviteRequired)) {
      res = req;
      req = inviteRequired;
      inviteRequired = false;
    }
    if (inviteRequired && betaGate(req, res)) {
      return res.redirect('/');
    }

    // Handle the request statically if the user-agent
    // is from Facebook's url scraper or if specifically requested.
    var parts = url.parse(req.url, true);
    if (parts.query['static'] === 'true' || (req.headers &&
        req.headers['user-agent'] &&
        req.headers['user-agent'].indexOf('facebookexternalhit') !== -1) ||
        (req.headers && req.headers['user-agent'] &&
        req.headers['user-agent'].indexOf('Twitterbot') !== -1) ||
        (req.headers && req.headers['user-agent'] &&
        req.headers['user-agent'].indexOf('+https://developers.google.com/+/web/snippet/') !== -1)
    ) {
      return sfn(req, res);
    
    // Hello google bot
    } else if (parts.query['_escaped_fragment_'] === '') {
      return sfn(req, res);
    }

    // Handle the request normally.
    res.render(template, {
      member: req.user,
      root: app.get('ROOT_URI')
    });
  }

  /*
   * Reject request if app is in beta mode.
   */
  function betaGate(req, res, member) {
    member = member || req.user;
    var gate = app.get('package').beta && (!member || !member.invited);
    if (gate && req.xhr) {
      var explain = '';
      if (!member) {
        explain = 'Hey, stranger! Please <a href="/">request an invite</a> so' +
            ' we can send you one when the time comes.';
      } else if (member._id.toString() !== req.user._id.toString()) {
        explain = 'Hey, comrade! This member has not been invited to The (new)' +
            ' Island yet.';
      }
      res.send(401, iutil.client({
        member: req.user,
        content: {page: null},
        root: app.get('ROOT_URI'),
        error: {
          message: 'Invite required',
          explain: explain
        },
        transloadit: transloadit(req)
      }));
    }
    return gate;
  }

  /*
   * Get messages from request.
   */
  function requestMessages(req) {
    messages = [];
    if (req.session && req.session.messages) {
      messages = req.session.messages;
      delete req.session.messages;
    }
    return messages;
  }

  /*
   * Pull requested event action types from request.
   */
  function parseEventActions(req, types) {
    var query = url.parse(req.url, true).query;
    var type = query['actions'];
    type = type.replace(/"/g, '');
    if (!type || type === 'all' || !_.contains(types, type)) {
      return types;
    } else {
      return [type];
    }
  }

  /*
   * Get sidebar content for a member.
   */
  function getSidebar(member, requestor, types, cb) {
    var sidebar = {};
    if (types.length === 0) {
      return this(null, sidebar);
    }

    var get = {
      _followers: function (cb) {
        var list = {followers: {items: []}};
        if (!member) {
          return cb();
        }
        var query = {subscribee_id: member._id, 'meta.style': 'follow',
            'meta.type': 'member'};
        Step(
          function () {
            db.Subscriptions.list(query, {limit: 16, sort: {created: -1},
                inflate: {subscriber: profiles.member}}, this.parallel());
            db.Subscriptions.count(query, this.parallel());
          },
          function (err, docs, count) {
            if (err) return cb(err);
            list.followers.items = docs || [];
            list.followers.count = count;
            list.followers.query = query;
            _.extend(sidebar, list);
            cb();
          }
        );
      },

      _followees: function (cb) {
        var list = {followees: {items: []}};
        if (!member) {
          return cb();
        }
        var query = {subscriber_id: member._id, 'meta.style': 'follow',
            'meta.type': 'member'};
        Step(
          function () {
            db.Subscriptions.list(query, {limit: 16, sort: {created: -1},
                inflate: {subscribee: profiles.member}}, this.parallel());
            db.Subscriptions.count(query, this.parallel());
          },
          function (err, docs, count) {
            if (err) return cb(err);
            list.followees.items = docs || [];
            list.followees.count = count;
            list.followees.query = query;
            _.extend(sidebar, list);
            cb();
          }
        );
      },

      _watchees: function (cb) {
        var list = {watchees: {items: []}};
        if (!member) {
          return cb();
        }
        Step(
          function () {
            db.Subscriptions.list({subscriber_id: member._id, 'meta.style': 'watch',
                'meta.type': 'crag'}, {sort: {created: -1},
                inflate: {subscribee: profiles.crag}}, this.parallel());
            db.Subscriptions.list({subscriber_id: member._id, 'meta.style': 'watch',
                'meta.type': 'ascent'}, {sort: {created: -1},
                inflate: {subscribee: profiles.ascent}}, this.parallel());
          },
          function (err, crags, ascents) {
            if (err) return cb(err);
            list.watchees.items = [].concat(crags, ascents).sort(function (a, b) {
              return b.created - a.created;
            });
            _.extend(sidebar, list);
            cb();
          }
        );
      },

      _ticks: function (cb) {
        var list = {ticks: {items: []}};
        var limit = 5;

        function _boulders (cb) {
          var skip = 0;
          var maxDepth = 100;
          var ticks = [];
          (function _fetch() {
            if (skip >= maxDepth) {
              return cb(null, ticks);
            }
            Step(
              function () {
                db.Ticks.list({type: 'b', sent: true, public: {$ne: false}},
                    {sort: {date: -1}, inflate: {author: profiles.member,
                    ascent: profiles.ascent, crag: profiles.crag}, skip: skip,
                    limit: limit}, this.parallel());
              },
              function (err, docs) {
                if (err) return cb(err);
                if (docs.length === 0) {
                  return cb(null, ticks);
                }
                _checkAccess(docs, ticks, _fetch, cb);
              }
            );
            skip += limit;
          })();
        }

        function _routes(cb) {
          var skip = 0;
          var maxDepth = 100;
          var ticks = [];
          (function _fetch() {
            if (skip >= maxDepth) {
              return cb(null, ticks);
            }
            Step(
              function () {
                db.Ticks.list({type: 'r', sent: true, public: {$ne: false}},
                    {sort: {date: -1}, inflate: {author: profiles.member,
                    ascent: profiles.ascent, crag: profiles.crag}, skip: skip,
                    limit: limit}, this.parallel());
              },
              function (err, docs) {
                if (err) return cb(err);
                if (docs.length === 0) {
                  return cb(null, ticks);
                }
                _checkAccess(docs, ticks, _fetch, cb);
              }
            );
            skip += limit;
          })();
        }

        function _checkAccess (docs, ticks, fetch, done) {
          var _cb = _.after(docs.length, function (err) {
            if (err) return done(err);
            if (ticks.length < limit) {
              return fetch();
            }
            done(null, ticks);
          });
          _.each(docs, function (t) {
            hasAccess(db, requestor, t, function (err, allow) {
              if (err) return _cb(err);
              if (allow) {
                ticks.push(t);
              }
              _cb();
            });
          });
        }

        Step(
          function () {
            _boulders(this.parallel());
            _routes(this.parallel());
          },
          function (err, boulders, routes) {
            if (err) return cb(err);
            list.ticks.items = [].concat(boulders, routes);
            _.extend(sidebar, list);
            cb();
          }
        );
      },

      _recommendations: function (cb) {
        var list = {recs: {items: []}};
        db.Ticks.aggregate([{$group: {_id: '$author_id', count: {$sum: 1}}}],
            function (err, docs) {
          if (err) return cb(err);

          // Get each rec as member.
          if (docs.length === 0) {
            return cb();
          }
          docs = _.first(docs.sort(function (a, b) {
            return b.count - a.count;
          }), 16);
          var _cb = _.after(docs.length, function (err) {
            if (err) return cb(err);
            list.recs.items.sort(function (a, b) {
              return b.tick_cnt - a.tick_cnt;
            });
            _.extend(sidebar, list);
            cb();
          });
          _.each(docs, function (r) {
            db.Members.read({_id: r._id}, function (err, m) {
              if (err) return _cb(err);
              list.recs.items.push({
                _id: m._id,
                username: m.username,
                role: m.role,
                displayName: m.displayName,
                privacy: Number(m.config.privacy.mode),
                gravatar: iutil.hash(m.primaryEmail || 'foo@bar.baz'),
                avatar: m.avatar ? m.avatar.ssl_url: undefined,
                avatar_big: m.avatar_big ? m.avatar_big.ssl_url: undefined,
                tick_cnt: r.count
              });
              _cb();
            });
          });
        });
      },

      _broadcasts: function (cb) {
        var list = {broadcasts: {items: []}};
        getBlogPostsWithCategory('broadcasts', 3, function (err, docs) {
          list.broadcasts.items = docs || [];
          _.extend(sidebar, list);
          cb(err);
        });
      }
    };

    Step(
      function () {
        _.each(types, _.bind(function (type) {
          get['_' + type](this.parallel());
        }, this));
      },
      function (err) {
        cb(err, sidebar);
      }
    );
  }

  /*
   * Get a blog post by slug.
   */
  function getBlogPost(slug, cb) {
    var post = poet.helpers.getPost(slug);
    if (!post) {
      return cb();
    }
    db.Members.read({username: post.by}, function (err, m) {
      if (err) return cb(err);
      post.author = m;
      cb(null, post);
    });
  }

  /*
   * Get blog posts from page to page.
   */
  function getBlogPosts(from, to, cb) {
    var posts = poet.helpers.getPosts(from, to);
    Step(
      function () {
        if (posts.length === 0) {
          return this();
        }
        var _this = _.after(posts.length, this);
        _.each(posts, function (p) {
          db.Members.read({username: p.by}, function (err, m) {
            if (err) return _this(err);
            p.author = m;
            _this();
          });
        });
      },
      function (err) {
        cb(err, posts);
      }
    );
  }

  /*
   * Get blog posts from a category.
   */
  function getBlogPostsWithCategory(cat, limit, cb) {
    if (typeof limit === 'function') {
      cb = limit;
      limit = false;
    }
    var posts = poet.helpers.postsWithCategory(cat);
    Step(
      function () {
        if (posts.length === 0) {
          return this();
        }
        if (limit) {
          posts = _.first(posts, limit);
        }
        var _this = _.after(posts.length, this);
        _.each(posts, function (p) {
          db.Members.read({username: p.by}, function (err, m) {
            if (err) return _this(err);
            p.author = m;
            _this();
          });
        });
      },
      function (err) {
        cb(err, posts);
      }
    );
  }

  /*
   * Returns PNG URL for a CartoDB static map.
   */
  function getStaticMap(location, cb) {
    if (!location || (!location.point && !location.box)) {
      return cb();
    }
    if (location.point && (!location.point.latitude ||
        !location.point.longitude)) {
      return cb();
    }
    if (location.box && (!location.box.north || !location.box.south ||
        !location.box.east || !location.box.west)) {
      return cb();
    }

    var mapConfig = {
      version: '1.3.0',
      layers: [{
        type: 'http',
        options: {
          urlTemplate: 'http://{s}.basemaps.cartocdn.com/light_nolabels/' +
              '{z}/{x}/{y}.png'
        }
      },
      {
        type: 'cartodb',
        options: {
          cartocss_version: '2.1.1',
          cartocss: map_css_static,
          sql: "select * from " + app.get('CARTODB_CRAGS_TABLE') +
              " where (forbidden is NULL or forbidden is FALSE)"
        }
      }]
    };

    Step(
      function () {
        var opts = {};
        opts.uri = 'https://' + app.get('CARTODB_USER') +
            '.cartodb.com/api/v1/map';
        opts.body = mapConfig;
        opts.json = true;
        request.post(opts, this);
      },
      function (err, r, body) {
        if (err) return cb(err);
        if (location.box) {
          var box = [location.box.west, location.box.south, location.box.east,
              location.box.north].join(',');
          return cb(null, ['https://' + app.get('CARTODB_USER') +
              '.cartodb.com/api/v1/map/static/bbox', body.layergroupid,
              box, 200, 200].join('/') + '.png');
        } else {
          return cb(null, ['https://' + app.get('CARTODB_USER') +
              '.cartodb.com/api/v1/map/static/center', body.layergroupid, 8,
              location.point.latitude, location.point.longitude, 200, 200]
              .join('/') + '.png');
        }
      }
    );
  }

  /*
   * Return degC.
   */
  function tempFtoC(d) {
    return Math.floor((d - 32) * 5/9);
  }

  /*
   * Get link for a poster for a remote video (vimeo/youtube).
   */
  function getRemoteVideoPoster(txt, cb) {
    var vid = iutil.parseVideoURL(txt);
    if (!vid) {
      return cb();
    }
    switch (vid.link.type) {
      case 'vimeo':
        request.get({
          uri: 'https://vimeo.com/api/v2/video/' + vid.link.id + '.json',
          json: true
        }, _.bind(function (err, res, body) {
          if (err) return cb(err);
          if (body.error) {
            return cb(body.error);
          }
          cb(null, {poster: {url: body[0].thumbnail_large, meta: {width: 640,
              height: 360}
          }});
        }, cb));
        break;
      case 'youtube':
        cb(null, {poster: {
          url: 'https://img.youtube.com/vi/' + vid.link.id + '/0.jpg',
          meta: {width: 480, height: 360}
        }});
        break;
      default: cb(); break;
    }
  }

  /*
   * Setup meta tags for robota.
   */
  function renderStatic(req, res, props, template) {
    props = props || {};
    template = template || 'folder';

    props.url = [process.env.tunnelURL || app.get('HOME_URI'), props.url || '']
        .join('/');
    props.type = props.type || 'website';
    props.schema = props.schema || 'Thing';

    props.description = (props.description || '').replace('\n', ' ');
    if (props.description !== '') {
      props.shortDescription = props.description;
      var tweet = [props.description, props.url].join(' ');
      var len = twitter.getTweetLength(tweet);
      if (len > 140) {
        var over = len - 140 + 3;
        props.shortDescription = _.prune(props.description,
            props.description.length - over);
      }
    }

    res.render(template, _.extend(props, {
      root: app.get('ROOT_URI'),
      assets: process.env.tunnelURL || app.get('HOME_URI'),
      member: req.user
    }));
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static', function (req, res) {
    Step(
      function () {

        // Get sidebar.
        getSidebar(req.user, req.user, ['ticks', 'broadcasts'],
            this.parallel());

        // Get notifications.
        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        } else {
          this.parallel()();
        }
      },
      function (err, sidebar, notes) {
        if (errorHandler(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(sidebar, {page: null})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(iutil.client(profile));
      }
    );
  });

  // Dashboard profile
  app.get('/service/dashboard', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, req.user ?
        ['post', 'session', 'crag', 'ascent']: ['post']);

    Step(
      function () {
        if (req.user) {
          return this();
        }
        db.Members.read({username: 'island'}, this);
      },
      function (err, mem) {
        if (errorHandler(err, req, res)) return;

        // Get events.
        if (req.user) {
          Events.feed({member_id: req.user._id, subscriber_id: req.user._id},
              actions, {limit: limit, cursor: cursor}, this.parallel());
        } else if (mem) {
          Events.feed({subscribee_id: mem._id, subscribee_type: 'member',
              subscribee_privacy: mem.config.privacy.mode}, actions,
              {limit: limit, cursor: cursor}, this.parallel());
        } else {
          this.parallel()(null, {events: []});
        }

        // Get sidebar.
        if (req.user) {
          getSidebar(req.user, req.user, ['ticks', 'watchees', 'followers',
              'followees', 'recommendations'], this.parallel());
        } else {
          getSidebar(undefined, undefined, ['ticks', 'broadcasts'],
              this.parallel());
        }

        // Get Notifications.
        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, feed, sidebar, notes) {
        if (errorHandler(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(sidebar, {events: feed.events}),
          messages: requestMessages(req),
          beta: app.get('package').beta
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(iutil.client(profile));
      }
    );
  });

  // Import from 8a.nu / 27crags profile
  app.get('/service/import/:slug', function (req, res) {
    Step(
      function () {
        var next = this.parallel();
        if (req.params.slug === 'undefined') {
          next();
        } else if (req.user) {
          var slugsplit = req.params.slug.split('-');
          var userId = slugsplit[0];
          var target = slugsplit[1];
          if (!userId || !target) {
            return this({code: 403, message: 'Invalid import slug'});
          }
          var fcn = null;
          if (target === '8a') {
            fcn = lib8a.getTicks;
          }
          else if (target === '27crags') {
            fcn = lib27crags.getTicks;
          }
          else {
            return this({code: 403, message: 'Invalid import slug target'});
          }
          fcn(userId, _.bind(function (err, ticks) {
            if (err) return next(err);

            /*
             * Modify some of the properties of the objects returned
             * for Island's tick model
             */

            var grades = ['3', '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+',
                '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+',
                '8b', '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+'];

            _.each(ticks, function (t) {
              t.date = t.date.valueOf();
              if (t.style === 'Onsight')
                t.tries = 1;
              else if (t.style === 'Flash')
                t.tries = 2;
              else if (t.style === 'Redpoint')
                t.tries = t.secondGo ? 3 : 5;
              else
                t.tries = 5;
              delete t.style;
              delete t.secondGo;
              t.feel = t.feel === 'Soft' ? -1 : (t.feel === 'Hard' ? 1 : 0);
              t.grade = grades.indexOf(t.grade);
              // Not a grade we recognize. This will remove this climb
              if (t.grade === -1) delete t.crag;
              t.id = iutil.hash(t.ascent);
            });

            // Return ticks that have crags identified and group by type
            var _next = _.after(ticks.length, function(err) {
              ticks = _.chain(ticks)
                .filter(function(t) { return t.hasOwnProperty('crag'); })
                .groupBy('type')
                .value();
              next(err, ticks);
            });

            // Fill crag and ascent information, if it can be found
            _.each(ticks, function (tick) {
              db.Crags.findOne({name: tick.crag}, function (err, crag) {
                if (err || !crag) {
                  delete tick.crag;
                  return _next();
                }
                tick.crag = crag;
                db.Ascents.findOne({crag_id: tick.crag._id, name: tick.ascent},
                    function (err, ascent) {
                  if (err) {
                    delete tick.crag;
                    return _next();
                  }
                  if (ascent) {
                    tick.ascent = ascent;
                  } else {
                    var ascentName = tick.ascent;
                    tick.ascent = {name: ascentName};
                  }
                  return _next();
                });
              });
            });
          }, this));
        }

        getSidebar(req.user, req.user, ['ticks', 'watchees'],
            this.parallel());

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        } else {
          this.parallel()();
        }
      },
      function (err, ticks, sidebar, notes) {
        if (errorHandler(err, req, res)) return;

        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(sidebar, {page: {ticks: ticks}})
        };

        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        res.send(iutil.client(profile));
      }
    );
  });

  // User ticks profile
  app.get('/service/ticks/:un', function (req, res) {
    if (betaGate(req, res)) return;
    var subscription;

    // Get the requested member.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (errorHandler(err, req, res, mem, 'member')) return;
      if (betaGate(req, res, mem)) return;

      Step(
        function () {

          // Get subscription.
          if (req.user) {
            if (req.user._id.toString() !== mem._id.toString()) {
              db.Subscriptions.read({subscriber_id: req.user._id,
                subscribee_id: mem._id, 'meta.style': 'follow'}, this);
            } else {
              this(null, undefined, true);
            }
          } else {
            this();
          }
        },
        function (err, sub, pass) {
          if (errorHandler(err, req, res)) return;
          subscription = sub;
          if (pass) {
            return this(null, true);
          }

          // Check ticks config setting.
          var privacy = mem.config.privacy.ticks === undefined ?
              '0': mem.config.privacy.ticks.toString();
          if (privacy === '0') { // public
            this(null, true);
          } else if (privacy === '1') { // public to followers
            this(null, !!subscription);
          } else if (privacy === '2') { // private
            var uid = req.user ? req.user._id.toString(): null;
            this(null, uid === mem._id.toString());
          }
        },
        function (err, allow) {
          if (errorHandler(err, req, res)) return;

          Step(
            function () {

              // Get ticks and an event feed
              if (allow) {
                db.Ticks.list({author_id: mem._id, sent: true},
                    {inflate: {ascent: profiles.ascent, crag: profiles.crag},
                    sort: {created: -1}}, this.parallel());


              } else {
                this.parallel()(null, []); // No events
                this.parallel()(null, []); // No feed
              }

              // Get Notifications.
              if (req.user && req.query.n !== '0') {
                db.Notifications.list({subscriber_id: req.user._id},
                    {sort: {created: -1}, limit: 5,
                    inflate: {event: profiles.event}}, this.parallel());
              }
            },
            function (err, ticks, notes) {
              if (errorHandler(err, req, res)) return;
              if (allow) {
                var count = _.reduce(ticks, function(m, t) {
                  if (t.type === 'r') {
                    m.r++;
                  } else {
                    m.b++;
                  }
                  return m;
                }, {r: 0, b: 0});
                var query = {action: {type: 'tick', query: {
                    author_id: mem._id,
                    sent: true,
                    type: count.b > count.r ? 'b' : 'r'}}};
                var self = this;
                Events.feed(query, ['tick'],
                    {sort: {date: -1}}, function(err, feed) {
                  return self(err, ticks, feed, notes);
                });
              } else {
                return this(null, [], [], notes);
              }
            },
            function (err, ticks, feed, notes) {
              if (errorHandler(err, req, res)) return;

              // we decrease the tick payload to whats relevant for
              // graph creation
              var smallTicks = [];
              _.each(ticks, function (t) {
                var _t = {};
                _t.ascent = {name: t.ascent.name, grades: grades}
                _t.crag = {name: t.crag.name,
                    country: t.crag.country};
                // FIXME
                var grades = gradeConverter[t.ascent.type].indexOf(t.ascent.grades)
                gradesAvg = Math.round(_.reduce(grades,
                    function(m, v) { return m + v; }, 0)
                    / grades.length);
                _t.grade = t.grade ? t.grade : gradesAvg;
                _t.type = t.type;
                _t.date = t.date;
                _t.tries = t.tries;
                _t._id = t._id;
                _t.key = t.key;
                smallTicks.push(_t);
              });

              var ticks = smallTicks;

              // Sort ticks by type.
              ticks = _.groupBy(ticks, 'type');

              if (errorHandler(err, req, res)) return;

              // Write profile.
              delete mem.password;
              delete mem.salt;

              mem.gravatar = iutil.hash(mem.primaryEmail || 'foo@bar.baz');
              mem.avatar = mem.avatar ? mem.avatar.ssl_url: undefined;
              mem.avatar_big = mem.avatar_big ? mem.avatar_big.ssl_url: undefined;

              var profile = {
                member: req.user,
                sub: subscription,
                transloadit: transloadit(req),
                content: {
                    page: {private: !allow, author: mem, ticks: ticks},
                    private: mem.config.privacy.mode.toString() === '1',
                    events: feed.events
                }
              };

              if (notes) {
                profile.notes = {
                  cursor: 1,
                  more: notes.length === 5,
                  items: notes
                };
              }

              // Send profile.
              res.send(iutil.client(profile));
            }
          );
        }
      );
    });
  });

  // Session profile
  app.get('/service/session/:key', function (req, res) {
    if (betaGate(req, res)) return;
    var key = Number(req.params.key);
    if (isNaN(key)) {
      return errorHandler(null, req, res, undefined, 'session');
    }

    Step(
      function () {

        // Get session and notifications.
        db.Sessions.read({key: key}, {inflate: {author: profiles.member,
            crag: profiles.crag}}, this.parallel());

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, session, notes) {
        if (errorHandler(err, req, res, session, 'session')) return;
        if (betaGate(req, res, session.author)) return;

        Step(
          function () {

            // Fill actions.
            db.fill(session, 'Actions', 'session_id', {sort: {index: 1}}, this);
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Get ticks.
            db.fill(session.actions, 'Ticks', 'action_id', {sort: {index: 1},
                inflate: {author: profiles.member, crag: profiles.crag,
                ascent: profiles.ascent}}, this);
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Fill ticks
            if (session.actions.length === 0) {
              return this();
            }
            var _this = _.after(session.actions.length, this);
            _.each(session.actions, _.bind(function (a) {
              if (a.ticks.length === 0) {
                return _this();
              }
              var __this = _.after(a.ticks.length, function (err) {
                if (err) return _this(err);
                a.ticks = _.reject(a.ticks, function (t) {
                  return t._reject === true;
                });
                _this();
              });
              _.each(a.ticks, function (t) {
                hasAccess(db, req.user, t, function (err, allow) {
                  if (err) return __this(err);
                  if (!allow) {
                    t._reject = true;
                    return __this();
                  }
                  Step (
                    function () {
                      db.inflate(t, {session: profiles.session}, this.parallel());
                      db.fill(t, 'Medias', 'parent_id', {sort: {created: -1}},
                          this.parallel());
                      db.fill(t, 'Hangtens', 'parent_id', this.parallel());
                      db.fill(t, 'Comments', 'parent_id', {sort: {created: -1},
                          reverse: true, inflate: {author: profiles.member}},
                          this.parallel());
                    }, __this
                  );
                });
              });
            }, this));
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Reject session if empty (due to bad access to ticks).
            var tickCnt = 0;
            _.each(session.actions, function (a) {
              _.each(a.ticks, function (t) { ++tickCnt; });
            });
            if (tickCnt === 0) {
              return errorHandler(null, req, res, undefined, 'session');
            }

            // Send only daily weather.
            if (session.weather && session.weather.daily &&
                session.weather.daily.data) {
              session.weather = {daily: session.weather.daily.data[0]};
            }

            Step(
              function () {
                if (!req.user) {
                  return this();
                }

                // Get user subscription.
                db.Subscriptions.read({subscriber_id: req.user._id,
                    subscribee_id: session._id}, this);
              },
              function (err, sub) {
                if (errorHandler(err, req, res)) return;

                // Write profile.
                var profile = {
                  member: req.user,
                  sub: sub,
                  transloadit: transloadit(req),
                  content: {page: session}
                };
                if (notes) {
                  profile.notes = {
                    cursor: 1,
                    more: notes.length === 5,
                    items: notes
                  };
                }

                // Send profile.
                res.send(iutil.client(profile));
              }
            );
          }
        );
      }
    );
  });

  // Tick profile
  app.get('/service/tick/:key', function (req, res) {
    if (betaGate(req, res)) return;
    var key = Number(req.params.key);
    if (isNaN(key)) {
      return errorHandler(null, req, res, undefined, 'tick');
    }

    // Get tick.
    db.Ticks.read({key: key}, {inflate: {author: profiles.member,
        crag: profiles.crag, session: profiles.session, ascent: profiles.ascent},
        inc: true}, function (err, tick) {
      if (errorHandler(err, req, res, tick, 'tick')) return;
      if (betaGate(req, res, tick.author)) return;

      Step(
        function () {

          // Check access.
          hasAccess(db, req.user, tick, this);
        },
        function (err, allow) {
          if (errorHandler(err, req, res)) return;
          if (!allow) {
            return errorHandler(null, req, res, undefined, 'tick');
          }

          // Update event count.
          db.Events._update({action_id: tick._id}, {$inc: {vcnt: 1}}, this);
        },
        function (err) {
          if (errorHandler(err, req, res)) return;
          if (!req.user) {
            return this();
          }

          // Get user subscription.
          db.Subscriptions.read({subscriber_id: req.user._id,
              subscribee_id: tick._id}, this.parallel());

          if (req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, sub, notes) {
          if (errorHandler(err, req, res)) return;

          Step(
            function () {

              // Fill tick.
              db.fill(tick, 'Medias', 'parent_id', {sort: {created: -1}},
                  this.parallel());
              db.fill(tick, 'Hangtens', 'parent_id', this.parallel());
              db.fill(tick, 'Comments', 'parent_id', {sort: {created: -1},
                  reverse: true, inflate: {author: profiles.member}},
                  this.parallel());
            },
            function (err) {
              if (errorHandler(err, req, res)) return;

              // Write profile.
              var profile = {
                member: req.user,
                sub: sub,
                transloadit: transloadit(req),
                content: {page: tick}
              };
              if (notes) {
                profile.notes = {
                  cursor: 1,
                  more: notes.length === 5,
                  items: notes
                };
              }

              // Send profile.
              res.send(iutil.client(profile));
            }
          );
        }
      );
    });
  });

  // Post profile
  app.get('/service/post/:un/:k', function (req, res) {
    if (betaGate(req, res)) return;
    var key = [req.params.un, req.params.k].join('/');

    // Get post.
    db.Posts.read({key: key}, {inflate: {author: profiles.member}, inc: true},
          function (err, post) {
      if (errorHandler(err, req, res, post, 'post')) return;
      if (betaGate(req, res, post.author)) return;

      Step(
        function () {

          // Check access.
          hasAccess(db, req.user, post, this);
        },
        function (err, allow) {
          if (errorHandler(err, req, res)) return;
          if (!allow) {
            return errorHandler(null, req, res, undefined, 'post');
          }

          // Update event count.
          db.Events._update({action_id: post._id}, {$inc: {vcnt: 1}}, this);
        },
        function (err) {
          if (errorHandler(err, req, res)) return;
          if (!req.user) {
            return this();
          }

          // Get user subscription.
          db.Subscriptions.read({subscriber_id: req.user._id,
              subscribee_id: post._id}, this.parallel());

          if (req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, sub, notes) {
          if (errorHandler(err, req, res)) return;

          Step(
            function () {

              // Fill post.
              db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}},
                  this.parallel());
              db.fill(post, 'Hangtens', 'parent_id', this.parallel());
              db.fill(post, 'Comments', 'parent_id', {sort: {created: -1},
                  reverse: true, inflate: {author: profiles.member}},
                  this.parallel());
            },
            function (err) {
              if (errorHandler(err, req, res)) return;

              // Write profile.
              var profile = {
                member: req.user,
                sub: sub,
                transloadit: transloadit(req),
                content: {page: post}
              };
              if (notes) {
                profile.notes = {
                  cursor: 1,
                  more: notes.length === 5,
                  items: notes
                };
              }

              // Send profile.
              res.send(iutil.client(profile));
            }
          );
        }
      );
    });
  });

  // Crag profile
  app.get('/service/crag/:y/:g', function (req, res) {
    if (betaGate(req, res)) return;
    var key = [req.params.y, req.params.g].join('/');
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['session', 'post', 'crag', 'ascent']);

    db.Crags.read({key: key, forbidden: {$ne: true}}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;

      Step(
        function () {

          // Get weather
          if (crag.location) {
            var weatherURL = 'https://api.forecast.io/forecast/' +
                app.get('FORECASTIO_API') + '/' +
                crag.location.latitude + ',' +
                crag.location.longitude;
            request.get(weatherURL, this.parallel());
          } else {
            this.parallel()();
          }

          // Get lists.
          Events.feed({member_id: req.user ? req.user._id: null,
              subscribee_id: crag._id}, actions,
              {limit: limit, cursor: cursor}, this.parallel());
          db.Ascents.list({crag_id: crag._id}, {sort: {name: 1}},
              this.parallel());
          db.Subscriptions.list({subscribee_id: crag._id, 'meta.style': 'watch',
            'meta.type': 'crag'}, {sort: {created: -1},
            inflate: {subscriber: profiles.member}}, this.parallel());

          // Get notifications.
          if (req.user && req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, weather, feed, ascents, watchers, notes) {
          if (errorHandler(err, req, res)) return;

          // Filter ascents by grade.
          crag.ascents = {b: {}, r: {}, bcnt: 0, rcnt: 0};
          _.each(ascents, function (a) {
            _.each(a.grades, function (g) {
              if (crag.ascents[a.type][g]) {
                crag.ascents[a.type][g].push(a);
              } else {
                crag.ascents[a.type][g] = [a];
              }
              ++crag.ascents[a.type + 'cnt'];
            });
          });

          // Write profile.
          var profile = {
            member: req.user,
            sub: feed.subscription,
            transloadit: transloadit(req),
            content: {
              page: crag,
              watchers: {items: watchers},
              events: feed.events
            }
          };
          if (notes) {
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };
          }
          if (weather) {
            profile.weather = JSON.parse(weather.body).currently;
          }

          // Send profile.
          res.send(iutil.client(profile));
        }
      );
    });
  });

  // Crag config profile
  app.get('/service/crag/:y/:g/config', function (req, res) {
    if (betaGate(req, res)) return;
    if (!req.user) {
      return res.send(403, iutil.client({
        content: {page: null},
        transloadit: transloadit(req),
        error: {message: 'Member invalid or not admin'}
      }));
    }
    var key = [req.params.y, req.params.g].join('/');

    db.Crags.read({key: key}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;
      if ((!crag.author_id || req.user._id.toString() !==
          crag.author_id.toString()) && !req.user.admin) {
        return res.send(403, iutil.client({
          member: req.user,
          content: {page: null},
          transloadit: transloadit(req),
          error: {message: 'Member invalid or not admin'}
        }));
      }

      Step(
        function () {

          // Get weather
          if (crag.location) {
            var weatherURL = 'https://api.forecast.io/forecast/' +
                app.get('FORECASTIO_API') + '/' +
                crag.location.latitude + ',' +
                crag.location.longitude;
            request.get(weatherURL, this.parallel());
          } else {
            this.parallel()();
          }

          // Get lists.
          db.Ascents.list({crag_id: crag._id}, {sort: {name: 1}},
              this.parallel());
          db.Subscriptions.list({subscribee_id: crag._id, 'meta.style': 'watch',
            'meta.type': 'crag'}, {sort: {created: -1},
            inflate: {subscriber: profiles.member}}, this.parallel());

          // Get notifications.
          if (req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, weather, ascents, watchers, notes) {
          if (errorHandler(err, req, res)) return;

          // Filter ascents by grade.
          crag.ascents = {b: {}, r: {}, bcnt: 0, rcnt: 0};
          _.each(ascents, function (a) {
            _.each(a.grades, function (g) {
              if (crag.ascents[a.type][g]) {
                crag.ascents[a.type][g].push(a);
              } else {
                crag.ascents[a.type][g] = [a];
              }
              ++crag.ascents[a.type + 'cnt'];
            });
          });

          // Write profile.
          var profile = {
            member: req.user,
            transloadit: transloadit(req),
            content: {
              page: crag,
              watchers: {items: watchers}
            }
          };
          if (notes) {
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };
          }
          if (weather) {
            profile.weather = JSON.parse(weather.body).currently;
          }

          // Send profile.
          res.send(iutil.client(profile));
        }
      );
    });
  });

  // Ascent profile
  app.get('/service/ascent/:y/:g/:t/:a', function (req, res) {
    if (betaGate(req, res)) return;
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['tick', 'post', 'ascent']);

    // Get the ascent.
    db.Ascents.read({key: key}, function (err, ascent) {
      if (errorHandler(err, req, res, ascent, 'ascent')) return;

      Step(
        function () {

          // Get weather
          if (ascent.location) {
            var weatherURL = 'https://api.forecast.io/forecast/' +
                app.get('FORECASTIO_API') + '/' +
                ascent.location.latitude + ',' +
                ascent.location.longitude;
            request.get(weatherURL, this.parallel());
          } else {
            this.parallel()();
          }

          // Get lists.
          Events.feed({member_id: req.user ? req.user._id: null,
              subscribee_id: ascent._id}, actions, {limit: limit,
              cursor: cursor}, this.parallel());
          db.Subscriptions.list({subscribee_id: ascent._id, 'meta.style': 'watch',
            'meta.type': 'ascent'}, {sort: {created: -1},
            inflate: {subscriber: profiles.member}}, this.parallel());

          // Get notifications.
          if (req.user && req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, weather, feed, watchers, notes) {
          if (errorHandler(err, req, res)) return;

          // Write profile.
          var profile = {
            member: req.user,
            sub: feed.subscription,
            transloadit: transloadit(req),
            content: {
              page: ascent,
              watchers: {items: watchers},
              events: feed.events
            }
          };
          if (notes) {
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };
          }
          if (weather) {
            profile.weather = JSON.parse(weather.body).currently;
          }

          // Send profile.
          res.send(iutil.client(profile));
        }
      );
    });
  });

  // Ascent config profile
  app.get('/service/ascent/:y/:g/:t/:a/config', function (req, res) {
    if (betaGate(req, res)) return;
    if (!req.user) {
      return res.send(403, iutil.client({
        content: {page: null},
        transloadit: transloadit(req),
        error: {message: 'Member invalid or not admin'}
      }));
    }
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');

    db.Ascents.read({key: key}, function (err, ascent) {
      if (errorHandler(err, req, res, ascent, 'ascent')) return;
      if ((!ascent.author_id || req.user._id.toString() !==
          ascent.author_id.toString()) && !req.user.admin) {
        return res.send(403, iutil.client({
          member: req.user,
          content: {page: null},
          transloadit: transloadit(req),
          error: {message: 'Member invalid or not admin'}
        }));
      }

      Step(
        function () {

          // Get weather
          if (ascent.location) {
            var weatherURL = 'https://api.forecast.io/forecast/' +
                app.get('FORECASTIO_API') + '/' +
                ascent.location.latitude + ',' +
                ascent.location.longitude;
            request.get(weatherURL, this.parallel());
          } else {
            this.parallel()();
          }

          // Get lists.
          db.Subscriptions.list({subscribee_id: ascent._id, 'meta.style': 'watch',
            'meta.type': 'ascent'}, {sort: {created: -1},
            inflate: {subscriber: profiles.member}}, this.parallel());

          // Get notifications.
          if (req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, weather, watchers, notes) {
          if (errorHandler(err, req, res)) return;

          // Write profile.
          var profile = {
            member: req.user,
            transloadit: transloadit(req),
            content: {
              page: ascent,
              watchers: {items: watchers}
            }
          };
          if (notes) {
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };
          }
          if (weather) {
            profile.weather = JSON.parse(weather.body).currently;
          }

          // Send profile.
          res.send(iutil.client(profile));
        }
      );
    });
  });

  // Crags profile
  app.get('/service/crags', function (req, res) {
    if (betaGate(req, res)) return;
    var params = {query: req.query.query, country: req.query.country};

    Step(
      function () {

        if (params.query || params.country) {
          Crags.find(params, this.parallel());
        } else {
          this.parallel()();
        }

        getSidebar(req.user, req.user, ['ticks', 'watchees', 'broadcasts'],
            this.parallel());

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, crags, sidebar, notes) {
        if (errorHandler(err, req, res)) return;

        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(sidebar, {page: null, crags: crags})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        res.send(iutil.client(profile));
      }
    );
  });

  // Films profile
  app.get('/service/films', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;

    Step(
      function () {
        var query = {action: {type: 'post', query: {'product.sku':
            {$ne: null}}}};
        Events.feed(query, ['post'], {limit: limit, cursor: cursor},
            this.parallel());

        getSidebar(req.user, req.user, ['ticks', 'broadcasts'],
            this.parallel());

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, feed, sidebar, notes) {
        if (errorHandler(err, req, res)) return;

        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(sidebar, {page: null, events: feed.events})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        res.send(iutil.client(profile));
      }
    );
  });

  // Media profile
  app.get('/service/media', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 15;

    Step(
      function () {
        Events.feed({all: true, media: true}, ['post', 'tick'], {limit: limit,
            cursor: cursor}, this.parallel());

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, feed, notes) {
        if (errorHandler(err, req, res)) return;

        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: {events: feed.events}
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        res.send(iutil.client(profile));
      }
    );
  });

  // Profiles
  app.get('/service/member/:un', function (req, res) {
    if (betaGate(req, res)) return;
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['session', 'post', 'crag', 'ascent']);

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (errorHandler(err, req, res, mem, 'member')) return;
      if (betaGate(req, res, mem)) return;

      Step(
        function () {

          // Get events feed.
          Events.feed({member_id: req.user ? req.user._id: null,
              subscribee_id: mem._id, subscribee_type: 'member',
              subscribee_privacy: mem.config.privacy.mode}, actions,
              {limit: limit, cursor: cursor}, this.parallel());

          // Get sidebar.
          getSidebar(mem, req.user, ['followers', 'followees',
              'watchees'], this.parallel());

          // Get team.
          if (mem.role === 2) {
            db.Members.list({team_ids: {$in: [mem._id]}},
                {sort: {created: -1}}, this.parallel());
          }

          // Get notifications.
          if (req.user && req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, feed, sidebar, team, notes) {
          if (errorHandler(err, req, res)) return;
          if (mem.role !== 2) {
            notes = team;
            team = false;
          }

          // Clean up team docs.
          if (team) {
            _.each(team, function (m) {
              delete m.password;
              delete m.salt;
              m.gravatar = iutil.hash(m.primaryEmail || 'foo@bar.baz');
              m.avatar = m.avatar ? m.avatar.ssl_url: undefined;
              m.avatar_big = m.avatar_big ? m.avatar_big.ssl_url: undefined;
            });
            mem.team = team;
          }

          // Write profile.
          delete mem.password;
          delete mem.salt;
          mem.gravatar = iutil.hash(mem.primaryEmail || 'foo@bar.baz');
          mem.avatar = mem.avatar ? mem.avatar.ssl_url: undefined;
          mem.avatar_big = mem.avatar_big ? mem.avatar_big.ssl_url: undefined;
          var profile = {
            member: req.user,
            sub: feed.subscription,
            transloadit: transloadit(req),
            content: _.extend(sidebar, {
              page: mem,
              events: feed.events,
              private: feed.private
            })
          };
          if (notes) {
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };
          }

          // Send profile.
          res.send(iutil.client(profile));
        }
      );
    });
  });

  // Settings profile
  app.get('/service/settings', function (req, res) {
    if (betaGate(req, res)) return;
    if (!req.user) {
      return res.send(403, iutil.client({
        member: req.user,
        content: {page: null},
        transloadit: transloadit(req),
        error: {message: 'Member invalid'}
      }));
    }

    if (req.query.n === '0') {
      return res.send(iutil.client({
        member: req.user,
        content: {page: req.user},
        transloadit: transloadit(req),
      }));
    }

    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (errorHandler(err, req, res)) return;

      res.send(iutil.client({
        member: req.user,
        content: {page: req.user},
        transloadit: transloadit(req),
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

  });

  // Settings profile
  app.get('/service/admin', function (req, res) {
    if (!req.user || !req.user.admin) {
      return res.send(403, iutil.client({
        member: req.user,
        content: {page: null},
        transloadit: transloadit(req),
        error: {message: 'Member invalid or not admin'}
      }));
    }

    Step(
      function () {

        // Get signups.
        db.Signups.list({email: {$exists: true}}, {sort: {created: -1}},
            this.parallel());

        // Get notifications.
        if (req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, signups, notes) {
        if (errorHandler(err, req, res)) return;

        Step(
          function () {
            if (signups.length === 0) {
              return this();
            }
            var _this = _.after(signups.length, this);
            _.each(signups, function (s) {
              if (!s.member_id) {
                return _this();
              } else {
                db.inflate(s, {member: profiles.member}, _this);
              }
            });
          },
          function (err) {

            // Write profile.
            var profile = {
              member: req.user,
              content: {signups: signups, page: null},
              transloadit: transloadit(req),
            };
            if (notes) {
              profile.notes = {
                cursor: 1,
                more: notes.length === 5,
                items: notes
              };
            }

            // Send profile.
            res.send(iutil.client(profile));
          }
        );
      }
    );
  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {
    Step(
      function () {
        getSidebar(req.user, req.user, ['ticks', 'broadcasts'], this);
      },
      function (err, sidebar) {
        if (errorHandler(err, req, res)) return;

        var ctx = {app: {profile: {content: _.extend(sidebar, {page: null})}}};
        renderStatic(req, res, {
          // body: _.template(splash_static).call(ctx)
        });
      }
    );
  }, 'folder'));

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Signin
  app.get('/signin', function (req, res) {
    var parts = url.parse(req.url, true);
    if (req.user) {
      return parts.query['static'] === 'true' ? res.redirect('/?static=true'):
          res.redirect('/');
    }

    var code = parts.query['ic'];
    req.session.invite_code = code;
    handler(function (req, res) {
      renderStatic(req, res, {
        url: 'signin',
        title: 'Signin',
        description: 'Sign In. Forgot your password? Sign Up.'
      });
    }, 'folder', req, res);
  });

  // Signup
  app.get('/signup', function (req, res) {
    var parts = url.parse(req.url, true);
    if (req.user) {
      return parts.query['static'] === 'true' ? res.redirect('/?static=true'):
          res.redirect('/');
    }

    var code = parts.query['ic'];
    if (!code && app.get('package').beta) {
      return res.redirect('/');
    }
    req.session.invite_code = code;
    handler(function (req, res) {
      renderStatic(req, res, {
        url: 'signup',
        title: 'Signup',
        description: 'Sign Up. Have an account? Sign In.'
      });
    }, 'folder', req, res);
  });

  // Crags
  app.get('/crags', _.bind(handler, undefined, function (req, res) {
    renderStatic(req, res, {
      url: 'crags',
      title: 'Crags',
      description: 'Search for a crag.'
    });
  }, 'folder', true));

  // Import
  app.get('/import', function (req, res) {
    var parts = url.parse(req.url, true);
    if (!req.user) {
      return parts.query['static'] === 'true' ? res.redirect('/?static=true'):
          res.redirect('/');
    }

    handler(function (req, res) {
      renderStatic(req, res);
    }, 'folder', req, res);
  });

  // Media
  app.get('/media', _.bind(handler, undefined, function (req, res) {
    Step(
      function () {
        db.Members.read({username: 'island'}, this);
      },
      function (err, mem) {
        if (errorHandler(err, req, res, mem, 'member')) return;
        db.Medias.read({author_id: mem._id, type: 'video', quality: 'ipad'},
            {sort: {created: -1}}, this);
      },
      function (err, media) {
        if (errorHandler(err, req, res)) return;
        var props = {
          url: 'media',
          title: 'Media',
          description: 'Recently uploaded photos and videos.'
        };
        if (media) {
          props.medias = [{image: media.poster, video: media.video}];
        }
        renderStatic(req, res, props);
      }
    );
  }, 'folder'));

  // Films
  app.get('/films', _.bind(handler, undefined, function (req, res) {
    Step(
      function () {
        db.Posts.list({'product.sku': {$ne: null}}, {sort: {created: -1}},
            this);
      },
      function (err, posts) {
        if (errorHandler(err, req, res)) return;
        db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
            function (err) {
          if (errorHandler(err, req, res)) return;

          var media = _.find(_.first(posts).medias, function (v) {
            return v.quality === 'ipad';
          });
          renderStatic(req, res, {
            url: 'films',
            title: 'Films',
            description: 'We\'re proud to bring you professional grade ' +
                'content. Many thanks to everyone that has made these films ' +
                'happen.',
            medias: [{image: media.poster, video: media.video}]
          });
        });
      }
    );
  }, 'folder'));

  // Blog category
  poet.addRoute('/blog/category/:category', function (req, res) {
    var cat = req.params.category;
    getBlogPostsWithCategory(cat, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      if (posts.length === 0) {
        return errorHandler(null, req, res, undefined, 'category');
      }
      renderStatic(req, res, {
        url: 'blog/category/' + req.params.category,
        posts: posts,
        category: cat,
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - ' + _.capitalize(cat),
        og_title: 'The Island Blog - ' + _.capitalize(cat),
        description: 'News and feature updates.'
      }, 'blog/category');

    });
  });

  // Blog page
  poet.addRoute('/blog/page/:page', function (req, res) {
    var page = Number(req.params.page);
    if (isNaN(page)) {
      return errorHandler(null, req, res, undefined, 'page');
    }
    var n = poet.helpers.options.postsPerPage;
    getBlogPosts(n * page - n, n * page, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      if (posts.length === 0) {
        return errorHandler(null, req, res, undefined, 'page');
      }

      renderStatic(req, res, {
        url: 'blog/page/' + req.params.page,
        page: page,
        posts: posts,
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - page ' + page,
        og_title: 'The Island Blog - page ' + page,
        description: 'News and feature updates.'
      }, 'blog/page');
    });
  });

  // Blog RSS
  app.get('/blog/rss', function (req, res) {
    var posts = poet.helpers.getPosts(0, poet.helpers.options.postsPerPage);
    res.setHeader('Content-Type', 'application/rss+xml');
    res.render('blog/rss', {posts: posts});
  });

  // Blog post
  poet.addRoute('/blog/:post', function (req, res) {
    getBlogPost(req.params.post, function (err, post) {
      if (errorHandler(err, req, res)) return;
      if (!post) {
        return errorHandler(null, req, res, undefined, 'post');
      }
      var img_rx = /<img src="([^"]+)"/g;
      var medias = [];
      var match;
      while (match = img_rx.exec(post.content)) {
        medias.push({image: {type: 'image', url: match[1], ssl_url: match[1]}});
      }
      renderStatic(req, res, {
        url: 'blog/' + req.params.post,
        type: 'article',
        schema: 'Article',
        post: post,
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - ' + post.title,
        og_title: post.title,
        medias: medias,
        description: post.description
      }, 'blog/post');
    });
  });

  // Blog
  app.get('/blog', function (req, res) {
    getBlogPosts(0, poet.helpers.options.postsPerPage, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      renderStatic(req, res, {
        page: 1,
        posts: posts,
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog',
        og_title: 'The Island Blog',
        description: 'News and feature updates.',
        url: 'blog'
      }, 'blog/index');
    });
  });

  // Privacy Policy
  app.get('/privacy', _.bind(handler, undefined, function (req, res) {
    renderStatic(req, res, {
      url: 'privacy',
      title: 'Privacy Policy',
      description: 'This Privacy Policy governs the manner in which ' +
          'We Are Island, Inc. collects, uses, maintains and discloses ' +
          'information collected from users (each, a "User") of the ' +
          'https://www.island.io website ("Site"). This privacy policy ' +
          'applies to the Site and all products and services offered by ' +
          'We Are Island, Inc.'
    });
  }, 'folder'));

  // Admin
  app.get('/admin', function (req, res) {
    var parts = url.parse(req.url, true);
    if (!req.user || !req.user.admin) {
      return parts.query['static'] === 'true' ? res.redirect('/?static=true'):
          res.redirect('/');
    }
    handler(function (req, res) {
      renderStatic(req, res);
    }, 'folder', req, res);
  });

  // Settings
  app.get('/settings', function (req, res) {
    var parts = url.parse(req.url, true);
    if (!req.user) {
      if (req.session) {
        req.session.referer = '/settings';
      }
      return parts.query['static'] === 'true' ?
          res.redirect('/signin?post_signin=settings&static=true'):
          res.redirect('/signin?post_signin=settings');
    }
    handler(function (req, res) {
      renderStatic(req, res);
    }, 'folder', true, req, res);
  });

  // Reset
  app.get('/reset', function (req, res) {
    var parts = url.parse(req.url, true);
    var token = parts.query['t'];

    function _handle() {
      handler(function (req, res) {
        renderStatic(req, res);
      }, 'folder', req, res);
    }

    // Check for token.
    if (token) {
      db.Keys.read({token: token}, function (err, key) {
        if (errorHandler(err, req, res)) return;
        if (!key) {
          return res.redirect('/');
        }

        // Get the user for the key.
        db.Members.read({_id: key.member_id}, function (err, mem) {
          if (errorHandler(err, req, res)) return;
          if (!mem) {
            return res.redirect('/');
          }

          // Attach the token to the session
          // so we can grab it later and verify.
          req.session.reset_token = token;

          // Handoff to the front-end.
          _handle();
        });
      });
    } else if (req.user) {
      _handle();
    } else {
      res.redirect('/');
    }
  });

  // Logout
  app.get('/logout', function (req, res) {
    var member_id = req.user ? req.user._id.toString(): null;
    req.logout();
    res.redirect('/');
    if (member_id) {
      events.send('mem-' + member_id, 'logout', {});
    }
  });

  //
  // Dynamic URL HTML pages.
  //

  // Crags
  app.get('/crags/:y', _.bind(handler, undefined, function (req, res) {
    var key = req.params.y;

    db.Countries.read({key: key}, function (err, country) {
      if (errorHandler(err, req, res, country, 'country')) return;

      Step(
        function () {
          db.Ascents.count({country_id: country._id, type: 'b'}, this.parallel());
          db.Ascents.count({country_id: country._id, type: 'r'}, this.parallel());
          db.Ticks.count({country_id: country._id}, this.parallel());
          db.Ticks.count({country_id: country._id, sent: true}, this.parallel());
          getStaticMap({box: country.meta}, this.parallel());
        },
        function (err, bcnt, rcnt, efforts, sends, imgURL) {
          if (errorHandler(err, req, res)) return;
          var desc = '';
          var s1, s2, s3, s4;

          s1 = _.numberFormat(bcnt, 0) + ' problem';
          if (bcnt !== 1) {
            s1 += 's';
          }

          s2 = _.numberFormat(rcnt, 0) + ' route';
          if (rcnt !== 1) {
            s2 += 's';
          }

          s3 = _.numberFormat(efforts, 0) + ' effort';
          if (efforts !== 1) {
            s3 += 's';
          }

          s4 = _.numberFormat(sends, 0) + ' ascent';
          if (sends !== 1) {
            s4 += 's';
          }

          desc += _([s1, s2, s3, s4]).reject(function (s) {
              return s === undefined; }).join(' | ');

          var location = {
            latitude: Number(((country.meta.north + country.meta.south) / 2).toFixed(4)),
            longitude: Number(((country.meta.east + country.meta.west) / 2).toFixed(4))
          };

          var props = {
            url: 'crags/' + key,
            title: country.name,
            description: desc,
            type: 'place',
            schema: 'Place',
            location: location
          };
          if (imgURL) {
            props.medias = [{image: {type: 'image', url: imgURL, ssl_url: imgURL, meta:
                {width: 200, height: 200}}}];
          }
          renderStatic(req, res, props);
        }
      );
    });
  }, 'folder', true));

  // Crag
  app.get('/crags/:y/:g', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g].join('/');

    db.Crags.read({key: key}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;

      Step(
        function () {
          db.Subscriptions.count({subscribee_id: crag._id, 'meta.style': 'watch',
              'meta.type': 'crag'}, this.parallel());
          db.Ticks.count({crag_id: crag._id}, this.parallel());
          db.Ticks.count({crag_id: crag._id, sent: true}, this.parallel());
          getStaticMap({point: crag.location}, this.parallel());
        },
        function (err, watchers, efforts, sends, imgURL) {
          if (errorHandler(err, req, res)) return;
          var title = [crag.name, crag.country].join(', ');
          var desc = crag.description && crag.description !== '' ?
              crag.description + '\n\n': '';
          var s1, s2, s3, s4, s5;

          s1 = _.numberFormat(crag.bcnt, 0) + ' problem';
          if (crag.bcnt !== 1) {
            s1 += 's';
          }

          s2 = _.numberFormat(crag.rcnt, 0) + ' route';
          if (crag.rcnt !== 1) {
            s2 += 's';
          }

          s3 = _.numberFormat(watchers, 0) + ' watcher';
          if (watchers !== 1) {
            s3 += 's';
          }

          s4 = _.numberFormat(efforts, 0) + ' effort';
          if (efforts !== 1) {
            s4 += 's';
          }

          s5 = _.numberFormat(sends, 0) + ' ascent';
          if (sends !== 1) {
            s5 += 's';
          }

          desc += _([s1, s2, s3, s4, s5]).reject(function (s) {
              return s === undefined; }).join(' | ');

          var props = {
            url: 'crags/' + key,
            title: title,
            description: desc,
            type: 'place',
            schema: 'Place',
            location: crag.location
          };
          if (imgURL) {
            props.medias = [{image: {type: 'image', url: imgURL,
                ssl_url: imgURL, meta: {width: 200, height: 200}}}];
          }
          renderStatic(req, res, props);
        }
      );
    });
  }, 'folder', true));

  // Ascents
  app.get('/crags/:y/:g/:t/:a', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g, req.params.t,
        req.params.a].join('/');

    db.Ascents.read({key: key}, function (err, ascent) {
      if (errorHandler(err, req, res, ascent, 'ascent')) return;

      Step(
        function () {
          db.Subscriptions.count({subscribee_id: ascent._id, 'meta.style': 'watch',
              'meta.type': 'ascent'}, this.parallel());
          db.Ticks.count({ascent_id: ascent._id}, this.parallel());
          db.Ticks.count({ascent_id: ascent._id, sent: true}, this.parallel());
          getStaticMap({point: ascent.location}, this.parallel());
        },
        function (err, watchers, efforts, sends, imgURL) {
          if (errorHandler(err, req, res)) return;
          var title = ascent.name + ' - ' + [ascent.crag, ascent.country].join(', ');
          var desc = ascent.description && ascent.description !== '' ?
              ascent.description + '\n\n': '';
          var s1, s2, s3;

          s1 = _.numberFormat(watchers, 0) + ' watcher';
          if (watchers !== 1) {
            s1 += 's';
          }

          s2 = _.numberFormat(efforts, 0) + ' effort';
          if (efforts !== 1) {
            s2 += 's';
          }

          s3 = _.numberFormat(sends, 0) + ' ascent';
          if (sends !== 1) {
            s3 += 's';
          }

          desc += _([s1, s2, s3]).reject(function (s) {
              return s === undefined; }).join(' | ');

          var props = {
            url: 'crags/' + key,
            title: title,
            description: desc,
            type: 'place',
            schema: 'Place',
            location: ascent.location
          };
          if (imgURL) {
            props.medias = [{image: {type: 'image', url: imgURL,
                ssl_url: imgURL, meta: {width: 200, height: 200}}}];
          }
          renderStatic(req, res, props);
        }
      );
    });
  }, 'folder', true));

  // Video embeds
  app.get('/embed/:vid', function (req, res) {
    md = new MobileDetect(req.headers['user-agent']);

    // Find the media by id.
    db.Medias.read({'video.id': req.params.vid, $or: [{quality: {$exists: true}},
        {quality:{$exists: false}, old_parent_id: {$exists: true}}]},
        {inflate: {author: profiles.member, old_parent: profiles.post}},
        function (err, med) {
      if (errorHandler(err, req, res, med, 'media')) return;

      Step(
        function () {
          if (med.old_parent) {
            return this();
          }
          db.Posts.read({_id: med.parent_id}, this.parallel());
          db.Ticks.read({_id: med.parent_id}, {inflate:
              {ascent: profiles.ascent}}, this.parallel());
        },
        function (err, post, tick) {
          med.parent = med.parent || post || tick;
          var qualities = _.reject(['iphone', 'ipad', 'hd'], function (q) {
            return q === med.quality;
          });
          var pid = med.parent ? med.parent._id:
              (med.old_parent ? med.old_parent._id: false);
          if (!pid) {
            return errorHandler(undefined, req, res, undefined, 'media');
          }
          db.Medias.list({parent_id: pid, type: 'video',
              quality: {$in: qualities}}, function (err, meds) {
            if (errorHandler(err, req, res)) return;
            if (meds.length === 0) {
              return errorHandler(undefined, req, res, undefined, 'media');
            }
            var parent = med.parent || med.old_parent;

            // Gather videos.
            if (med.quality) {
              meds.push(med);
            }
            var iphone = _.find(meds, function (m) {
                return m.quality === 'iphone'; });
            var ipad = _.find(meds, function (m) {
                return m.quality === 'ipad'; });
            var hd = _.find(meds, function (m) {
                return m.quality === 'hd'; });
            var params = {sharing: {key: parent.session_id ? 'efforts/' +
                parent.key: parent.key}};

            // Desktops and mobile tablets.
            if (!md.mobile() || (md.mobile() && md.tablet())) {
              _.extend(params, {
                playlist: [{
                  image: hd.poster.ssl_url,
                  sources: [{
                    file: md.is('iOS') ? ipad.video.ios_url: ipad.video.ssl_url,
                    label: '1200k'
                  },
                  {
                    file: md.is('iOS') ? hd.video.ios_url: hd.video.ssl_url,
                    label: '4000k'
                  }]
                }]
              });

            // Mobile phones, ipod, etc.
            } else {
              _.extend(params, {
                playlist: [{
                  image: iphone.poster.ssl_url,
                  sources: [{
                    file: md.is('iOS') ? iphone.video.ios_url: iphone.video.ssl_url,
                    label: '700k'
                  },
                  {
                    file: md.is('iOS') ?
                        ipad.video.ios_url: ipad.video.ssl_url,
                    label: '1200k'
                  }]
                }]
              });
            }

            var title = med.author.displayName;
            if (med.parent.ascent) {
              title += ' - ' + med.parent.ascent.name;
            } else if (med.parent.title && med.parent.title !== '') {
              title += med.parent.title;
            }
            res.render('embed', {
              url: (process.env.tunnelURL || app.get('HOME_URI')) + '/embed/' +
                  req.params.vid,
              type: 'video',
              schema: 'VideoObject',
              title: title,
              description: med.parent.body || med.parent.note,
              media: med,
              root: app.get('ROOT_URI'),
              assets: process.env.tunnelURL || app.get('HOME_URI'),
              member: req.user,
              src: ipad.video.ssl_url,
              params: JSON.stringify(params)
            });
          });
        }
      );
    });
  });

  // Session permalink
  app.get('/sessions/:k', _.bind(handler, undefined, function (req, res) {
    var key = Number(req.params.k);

    db.Sessions.read({key: key}, {inflate: {author: profiles.member,
        crag: profiles.crag}}, function (err, session) {
      if (errorHandler(err, req, res, session, 'session')) return;

      Step(
        function () {
          db.fill(session, 'Ticks', 'session_id', {inflate: {ascent:
              profiles.ascent}}, this);
        },
        function (err) {
          if (err) return this(err);
          if (session.ticks.length === 0) {
            return this();
          }
          var notes = '';
          _.each(session.ticks, function (tick) {
            notes += tick.note + ' ';
          });
          getStaticMap({point: session.crag.location}, this.parallel());
          getRemoteVideoPoster(notes, this.parallel());
          _.each(session.ticks, _.bind(function (tick) {
            db.fill(tick, 'Medias', 'parent_id', this.parallel());
          }, this));
        },
        function (err, imgURL, link) {
          if (err) return this(err);
          var title = dateFormat(session.date, 'mmm d, yyyy');
          title += ' - ' + [session.crag.name, session.crag.country].join(', ');
          var desc = '';

          var medias = [];
          _.each(session.ticks, function (tick, i) {
            desc += tick.ascent.name;
            if (tick.sent) {
              if (tick.grade) {
                desc += ' ' + gradeConverter[tick.type].indexes(tick.grade,
                    session.crag.country) + ' ✓';
              } else {
                desc += ' ✓';
              }
            } else {
              desc += ' (work)';
            }
            if (i !== session.ticks.length - 1) {
              desc += ', ';
            }
            medias = [].concat(medias, tick.medias);
          });
          if (imgURL) {
            medias.push({image: {type: 'image', url: imgURL, ssl_url: imgURL,
                meta: {width: 200, height: 200}}});
          }

          var daily = (session.weather || {}).daily;
          if (daily && daily.data && daily.data[0]) {
            data = daily.data[0];
            if (desc !== '') {
              desc += ' ';
            }
            desc += '----------------> ';
            desc += data.summary.replace('.', '');
            var minT = data.temperatureMin;
            var maxT = data.temperatureMax;
            var cloudCover = Math.round(data.cloudCover * 100);
            if (minT && maxT) {
              desc += ' (low ' + tempFtoC(minT) + '°C @ ' +
                  dateFormat(new Date(data.temperatureMinTime * 1000),
                  'h:MM TT') + ', ';
              desc += 'high ' + tempFtoC(maxT) + '°C @ ' +
                  dateFormat(new Date(data.temperatureMaxTime * 1000),
                  'h:MM TT') + ', ';
              desc += 'dew point ' + tempFtoC(data.dewPoint) + '°C, ';
              desc += 'humidity ' + Math.round(data.humidity * 100) + '%, ';
              desc += !isNaN(cloudCover) ? 'cloud cover ' + cloudCover + '%, ': '';
              desc += 'wind speed ' + (data.windSpeed * 3.6).toFixed(1) + ' km/hr';
              if (data.precipIntensity > 0) {
                desc += ', precip. intensity' + data.precipIntensity +
                    ' - ' + data.precipType + ').';
              } else {
                desc += ').';
              }
            }
          }

          var props = {
            url: 'sessions/' + session.key,
            title: title,
            description: desc,
            type: 'place',
            schema: 'Place',
            location: session.crag.location,
            medias: medias
          };
          if (link) {
            props.link = link;
          }
          renderStatic(req, res, props);
        }
      );
    });
  }, 'folder', true));

  // Tick permalink
  app.get('/efforts/:k', _.bind(handler, undefined, function (req, res) {
    var key = Number(req.params.k);

    db.Ticks.read({key: key}, {inflate: {author: profiles.member,
        crag: profiles.crag, ascent: profiles.ascent,
        session: profiles.session}}, function (err, tick) {
      if (errorHandler(err, req, res, tick, 'tick')) return;

      Step(
        function (err) {
          getStaticMap({point: tick.ascent.location}, this.parallel());
          getRemoteVideoPoster(tick.note, this.parallel());
          db.fill(tick, 'Medias', 'parent_id', this.parallel());
        },
        function (err, imgURL, link) {
          if (err) return this(err);
          var title = '';
          var time;
          if (tick.time) {
            var d = new Date(tick.date);
            d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            var secs = (d.valueOf() / 1000) + tick.time * 60;
            time = dateFormat(new Date(secs * 1000), 'h:MM TT');
          }
          if (time) {
            title += time + ', ';
          }
          title += dateFormat(tick.date, 'mmm d, yyyy') +
              ' - ' + [tick.ascent.name, tick.crag.name].join(', ');
          if (tick.sent) {
            if (tick.grade) {
              title += ' ' + gradeConverter[tick.type].indexes(tick.grade,
                  tick.crag.country) + ' ✓';
            } else {
              title += ' ✓';
            }
          } else {
            title += ' (work)';
          }
          var desc = tick.note || '';

          var medias = tick.medias;
          if (imgURL) {
            medias.push({image: {type: 'image', url: imgURL, ssl_url: imgURL,
                meta: {width: 200, height: 200}}});
          }

          var weather = tick.session.weather || {};
          var data = weather.hourly || weather.daily;
          if (data && data.data && data.data[0]) {
            data = data.data[0];
          }

          if (data) {
            if (desc !== '') {
              desc += ' ';
            }
            desc += '----------------> ';
            desc += data.summary.replace('.', '');
            var temp = data.temperature;
            var minT = data.temperatureMin;
            var maxT = data.temperatureMax;
            var cloudCover = Math.round(data.cloudCover * 100);
            if (temp || (minT && maxT)) {
              if (temp) {
                desc += ' (' + tempFtoC(temp) + '°C @ ' + time + ', ';
              } else {
                desc += ' (low ' + tempFtoC(minT) + '°C @ ' +
                    dateFormat(new Date(data.temperatureMinTime * 1000),
                    'h:MM TT') + ', ';
                desc += 'high ' + tempFtoC(maxT) + '°C @ ' +
                    dateFormat(new Date(data.temperatureMaxTime * 1000),
                    'h:MM TT') + ', ';
              }
              desc += 'dew point ' + tempFtoC(data.dewPoint) + '°C, ';
              desc += 'humidity ' + Math.round(data.humidity * 100) + '%, ';
              desc += !isNaN(cloudCover) ? 'cloud cover ' + cloudCover + '%, ': '';
              desc += 'wind speed ' + (data.windSpeed * 3.6).toFixed(1) + ' km/hr';
              if (data.precipIntensity > 0) {
                desc += ', precip. intensity' + data.precipIntensity +
                    ' - ' + data.precipType + ').';
              } else {
                desc += ').';
              }
            }
          }

          var props = {
            url: 'efforts/' + tick.key,
            title: title,
            description: desc,
            type: 'place',
            schema: 'Place',
            location: tick.crag.location,
            medias: medias
          };
          if (link) {
            props.link = link;
          }
          renderStatic(req, res, props);
        }
      );
    });
  }, 'folder', true));

  // Ticks
  app.get('/:un/ascents', _.bind(handler, undefined, function (req, res) {
    db.Members.read({username: req.params.un},
        function (err, mem) {
      if (errorHandler(err, req, res, mem, 'profile')) return;
      renderStatic(req, res, {
        url: mem.username + '/ascents',
        title: mem.displayName + '\'s Ascents',
        description: mem.description,
        medias: [{image: mem.avatar_full || mem.image}],
        type: 'profile',
        schema: 'Person'
      });
    });
  }, 'folder', true));

  // Post permalink
  app.get('/:un/:k', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.un, req.params.k].join('/');

    db.Posts.read({key: key}, {inflate: {author: profiles.member}},
        function (err, post) {
      if (errorHandler(err, req, res, post, 'post')) return;
      db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}},
          {$or: [{type: {$ne: 'video'}}, {quality: 'ipad'}]}, function (err) {
        if (errorHandler(err, req, res)) return;

        Step(
          function () {
            getRemoteVideoPoster(post.body, this);
          },
          function (err, link) {
            if (errorHandler(err, req, res)) return;

            var title = post.author.displayName;
            if (post.title) {
              title += ' - ' + post.title;
            }
            if (post.type === 'instagram') {
              post.medias.push({image: {type: 'image',
                  url: post.remote_media.images.standard_resolution.url}});
            }
            var props = {
              url: post.key,
              title: title,
              og_title: post.title || post.author.displayName + '\'s post',
              description: post.body,
              author: post.author.displayName,
              medias: post.medias,
              type: 'article',
              schema: 'Article'
            };
            if (link) {
              props.link = link;
            }
            renderStatic(req, res, props);
          }
        );
      });
    });
  }, 'folder', true));

  // Profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {
    db.Members.read({username: req.params.un},
        function (err, mem) {
      if (errorHandler(err, req, res, mem, 'profile')) return;
      renderStatic(req, res, {
        url: mem.username,
        title: mem.displayName,
        description: mem.description,
        medias: [{image: mem.avatar_full || mem.image}],
        type: 'profile',
        schema: 'Person'
      });
    });
  }, 'folder', true));

};
