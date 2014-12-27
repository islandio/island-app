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
var Client = require('./client').Client;
var Events = require('./resources/event');
var Crags = require('./resources/crag');
var collections = require('island-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../app');
var lib8a = require('island-lib8a');

// Client-side templates rendered as static pages on server. These
// are cached in memory for speed
var splash_static = fs.readFileSync('public/templates/splash.html', 'utf8');
var signin_static = fs.readFileSync('public/templates/signin.html', 'utf8');

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
    }
  }: {};
}

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
    if (parts.query['static'] === 'true' || (req.headers
        && req.headers['user-agent']
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1)) {
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
        explain = 'Hey, stranger! Please <a href="/">request an invite</a> so'
            + ' we can send you one when the time comes.';
      } else if (member._id.toString() !== req.user._id.toString()) {
        explain = 'Hey, comrade! This member has not been invited to The (new)'
            + ' Island yet.';
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
  function getSidebarLists(member, requestor, cb) {
    var lists = {watchees: {items: []}, followers: {items: []},
        followees: {items: []}, ticks: {items: []}};
    if (!member) {
      return cb(null, lists);
    }

    Step(
      function () {
        db.Subscriptions.list({subscribee_id: member._id, 'meta.style': 'follow',
            'meta.type': 'member'}, {sort: {created: -1},
            inflate: {subscriber: profiles.member}}, this.parallel());
        db.Subscriptions.list({subscriber_id: member._id, 'meta.style': 'follow',
            'meta.type': 'member'}, {sort: {created: -1},
            inflate: {subscribee: profiles.member}}, this.parallel());
        db.Subscriptions.list({subscriber_id: member._id, 'meta.style': 'watch',
            'meta.type': 'crag'}, {sort: {created: -1},
            inflate: {subscribee: profiles.crag}}, this.parallel());
        db.Subscriptions.list({subscriber_id: member._id, 'meta.style': 'watch',
            'meta.type': 'ascent'}, {sort: {created: -1},
            inflate: {subscribee: profiles.ascent}}, this.parallel());
        db.Ticks.list({author_id: member._id, sent: true}, {sort: {created: -1},
            inflate: {ascent: profiles.ascent}}, this.parallel());
      },
      function (err, followers, followees, crags, ascents, ticks) {
        if (err) return cb(err);
        lists.followers.items = followers;
        lists.followees.items = followees;

        // Sort watchees.
        lists.watchees.items = [].concat(crags, ascents).sort(function (a, b) {
          return b.created - a.created;
        });

        // Check tick access.
        var _this = _.after(ticks.length, this);
        _.each(ticks, function (t) {
          hasAccess(db, requestor, t, function (err, allow) {
            if (err) return _this(err);
            if (allow) {
              lists.ticks.items.push(t);
            }
            _this();
          });
        });
      },
      function (err) {
        if (err) return cb(err);
        cb(err, lists);
      }
    );
  }

  /*
   * Get sidebar content for a public user.
   */
  function getPublicSidebarLists(cb) {
    var lists = {ticks: {items: []}, broadcasts: {items: []}};

    Step(
      function () {
        db.Ticks.list({sent: true, public: {$ne: false}}, {sort: {created: -1},
            inflate: {ascent: profiles.ascent}}, this.parallel());
        getBlogPostsWithCategory('broadcasts', 3, this.parallel());
      },
      function (err, ticks, broadcasts) {
        if (err) return cb(err);
        lists.ticks.items = ticks;
        lists.broadcasts.items = broadcasts;
        cb(null, lists);
      }
    );
  }

  /*
   * Get lists for splash.
   */
  function getSplashLists(cb) {
    var lists = {ascents: {items: []}};
    cb(null, lists);
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
        })
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
        })
      },
      function (err) {
        cb(err, posts);
      }
    );
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static', function (req, res) {
    Step(
      function () {
        if (!req.user) {
          return this();
        }

        getSidebarLists(req.user, req.user, this.parallel());

        // Get notifications.
        if (req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        } else {
          this.parallel()();
        }
      },
      function (err, notes) {
        if (errorHandler(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: {page: null}
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
        getPublicSidebarLists(this.parallel());
        if (req.user) {
          getSidebarLists(req.user, req.user, this.parallel());
        } else {
          getSplashLists(this.parallel());
        }

        // Get Notifications.
        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, feed, publicLists, lists, notes) {
        if (errorHandler(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(_.extend(lists, publicLists),
              {events: feed.events}),
          messages: requestMessages(req)
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

  // // Trending profile
  // app.get('/service/trending', function (req, res) {
  //   var cursor = req.body.cursor || 0;
  //   var limit = req.body.limit || 5;
  //   var actions = ['sessions'];

  //   Step(
  //     function () {

  //       // Get events.
  //       Events.feed({public: true}, actions, {limit: limit, cursor: cursor},
  //           this.parallel());

  //       // Get sidebar.
  //       getPublicSidebarLists(this.parallel());
  //       if (req.user) {
  //         getSidebarLists(req.user, req.user, this.parallel());
  //       }

  //       // Get Notifications.
  //       if (req.user && req.query.n !== '0') {
  //         db.Notifications.list({subscriber_id: req.user._id},
  //             {sort: {created: -1}, limit: 5,
  //             inflate: {event: profiles.event}}, this.parallel());
  //       }
  //     },
  //     function (err, feed, publicLists, lists, notes) {
  //       if (errorHandler(err, req, res)) return;
  //       lists = lists || {};

  //       // Write profile.
  //       var profile = {
  //         member: req.user,
  //         transloadit: transloadit(req),
  //         content: _.extend(_.extend(lists, publicLists),
  //             {events: feed.events})
  //       };
  //       if (notes) {
  //         profile.notes = {
  //           cursor: 1,
  //           more: notes.length === 5,
  //           items: notes
  //         };
  //       }

  //       // Send profile.
  //       res.send(iutil.client(profile));
  //     }
  //   );
  // });

  // Import from 8a profile
  app.get('/service/import/:userId', function (req, res) {
    Step(
      function () {
        if (!req.user) {
          return this();
        }

        var next = this.parallel();
        if (req.params.userId === 'undefined') {
          next();
        }

        else {
          lib8a.getTicks(req.params.userId, _.bind(function(err, ticks) {
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
              t.id = iutil.hash(t.ascent);
            });

            // Return ticks that have crags identified and group by type
            var _next = _.after(ticks.length, function(err) {
              ticks = _.chain(ticks)
                .filter(function(t) { return t.hasOwnProperty('crag') })
                .groupBy('type')
                .value()
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

        // Get notifications.
        if (req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        } else {
          this.parallel()();
        }
      },
      function (err, ticks, notes) {
        if (errorHandler(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: {page: { ticks: ticks}}
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
  // User ticks profile
  app.get('/service/ticks/:un', function (req, res) {
    if (betaGate(req, res)) return;
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
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
          if (privacy === '0') {
            this(null, true);
          } else if (privacy === '1') {
            this(null, !!subscription);
          } else if (privacy === '2') {
            this(null, req.user._id.toString() === mem._id.toString());
          }
        },
        function (err, allow) {
          if (errorHandler(err, req, res)) return;

          Step(
            function () {

              // Get ticks.
              if (allow) {
                db.Ticks.list({author_id: mem._id, sent: true},
                    {inflate: {author: profiles.member, ascent: profiles.ascent,
                    session: profiles.session}, sort: {created: -1}},
                    this.parallel());
              } else {
                this.parallel()(null, []);
              }

              // Get sidebar.
              getPublicSidebarLists(this.parallel());
              getSidebarLists(mem, req.user, this.parallel());

              // Get Notifications.
              if (req.user && req.query.n !== '0') {
                db.Notifications.list({subscriber_id: req.user._id},
                    {sort: {created: -1}, limit: 5,
                    inflate: {event: profiles.event}}, this.parallel());
              }
            },
            function (err, ticks, publicLists, lists, notes) {
              if (errorHandler(err, req, res)) return;

              Step(
                function () {
                  if (ticks.length === 0) {
                    return this();
                  }

                  // Fill ticks.
                  db.fill(ticks, 'Medias', 'parent_id', {sort: {created: -1}},
                      this.parallel());
                  db.fill(ticks, 'Hangtens', 'parent_id', this.parallel());
                  db.fill(ticks, 'Comments', 'parent_id', {sort: {created: -1},
                      reverse: true, inflate: {author: profiles.member}},
                      this.parallel());
                },
                function (err) {
                  if (errorHandler(err, req, res)) return;

                  // Sort ticks by type.
                  ticks = _.groupBy(ticks, 'type');

                  // Write profile.
                  delete mem.password;
                  delete mem.salt;
                  mem.gravatar = iutil.hash(mem.primaryEmail || 'foo@bar.baz');
                  var profile = {
                    member: req.user,
                    sub: subscription,
                    transloadit: transloadit(req),
                    content: _.extend(_.extend(lists, publicLists),
                        {page: {private: !allow, author: mem, ticks: ticks},
                        private: mem.config.privacy.mode.toString() === '1'})
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
                inflate: {author: profiles.member,
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
            if (session.weather && session.weather.daily
                && session.weather.daily.data) {
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
    var key = [req.params.un, req.params.k].join('/').toLowerCase();

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
            var weatherURL = 'https://api.forecast.io/forecast/'
                + app.get('FORECASTIO_API') + '/'
                + crag.location.latitude + ','
                + crag.location.longitude;
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
            var weatherURL = 'https://api.forecast.io/forecast/'
                + app.get('FORECASTIO_API') + '/'
                + ascent.location.latitude + ','
                + ascent.location.longitude;
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

  // Crags profile
  app.get('/service/crags', function (req, res) {
    if (betaGate(req, res)) return;
    var params = {query: req.query.query, country: req.query.country};

    Step(
      function () {
        if (!req.user && !params.query && !params.country) {
          return this();
        }

        // Get crags.
        if (params.query || params.country) {
          Crags.find(params, this.parallel());
        } else {
          this.parallel()();
        }

        // Get sidebar.
        getPublicSidebarLists(this.parallel());
        if (req.user) {
          getSidebarLists(req.user, req.user, this.parallel());
        }

        // Get notifications.
        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, crags, publicLists, lists, notes) {
        if (errorHandler(err, req, res)) return;
        lists = lists || {};

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(_.extend(lists, publicLists),
              {page: null, crags: crags})
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

  // Films profile
  app.get('/service/films', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;

    Step(
      function () {

        // Get events.
        var query = {action: {type: 'post', query: {'product.sku': {$ne: null}}}};
        Events.feed(query, ['post'], {limit: limit, cursor: cursor},
            this.parallel());

        // Get sidebar.
        getPublicSidebarLists(this.parallel());
        if (req.user) {
          getSidebarLists(req.user, req.user, this.parallel());
        }

        // Get notifications.
        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, feed, publicLists, lists, notes) {
        if (errorHandler(err, req, res)) return;
        lists = lists || {};

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(_.extend(lists, publicLists),
              {page: null, events: feed.events})
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
          getSidebarLists(mem, req.user, this.parallel());

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
        function (err, feed, lists, team, notes) {
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
            });
            mem.team = team;
          }

          // Write profile.
          delete mem.password;
          delete mem.salt;
          mem.gravatar = iutil.hash(mem.primaryEmail || 'foo@bar.baz');
          var profile = {
            member: req.user,
            sub: feed.subscription,
            transloadit: transloadit(req),
            content: _.extend(lists, {
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
        error: {message: 'User invalid'}
      }));
    }

    if (req.query.n === '0') {
      return res.send(iutil.client({
        member: req.user,
        content: {page: req.user},
        transloadit: transloadit(req),
      }));
    }

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (errorHandler(err, req, res)) return;

      // Write and send profile.
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
        error: {message: 'User invalid or not admin'}
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
    res.render('static', {
      key: 'splash',
      body: _.template(splash_static, {}),
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Signin
  app.get('/signin', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    var parts = url.parse(req.url, true);
    var code = parts.query['ic'];
    req.session.invite_code = code;

    handler(function (req, res) {
      res.render('static', {
        key: 'signin',
        title: 'Signin',
        body: _.template(signin_static, {}),
        root: app.get('ROOT_URI')
      });
    }, 'folder', req, res);

  });

  // Signup
  app.get('/signup', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    var parts = url.parse(req.url, true);
    var code = parts.query['ic'];
    if (!code) {
      return res.redirect('/');
    }
    req.session.invite_code = code;

    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', req, res);
  });

  // Crags
  app.get('/crags', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Films
  app.get('/films', _.bind(handler, undefined, function (req, res) {
    
    // List film post images.
    db.Posts.list({'product.sku': {$ne: null}}, {sort: {created: -1}, limit: 5},
        function (err, posts) {
      if (errorHandler(err, req, res)) return;
      db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
          function (err) {
        if (errorHandler(err, req, res)) return;

        // Render.
        res.render('static', {
          key: 'films',
          title: 'Films',
          body: 'Original content by Island',
          posts: posts, 
          root: app.get('ROOT_URI')
        });
      });
    });
  }, 'folder'));

  // Blog category
  poet.addRoute('/blog/category/:category', function (req, res) {
    var cat = req.params.category;
    getBlogPostsWithCategory(cat, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      if (posts.length === 0) {
        return errorHandler(null, req, res, undefined, 'category');
      }
      res.render('blog/category', {
        posts: posts,
        category: cat,
        member: req.user,
        root: app.get('ROOT_URI'),
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - ' + cat
      });
    });
  });

  // Blog page
  poet.addRoute('/blog/page/:p', function (req, res) {
    var p = Number(req.params.p);
    if (isNaN(p)) {
      return errorHandler(null, req, res, undefined, 'page');
    }
    var n = poet.helpers.options.postsPerPage;
    getBlogPosts(n * p - n, n * p, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      if (posts.length === 0) {
        return errorHandler(null, req, res, undefined, 'page');
      }
      res.render('blog/page', {
        page: p,
        posts: posts,
        member: req.user,
        root: app.get('ROOT_URI'),
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - ' + p
      });
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
      res.render('blog/post', {
        post: post,
        member: req.user,
        root: app.get('ROOT_URI'),
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog - ' + post.title
      });
    });
  });

  // Blog
  app.get('/blog', function (req, res) {
    getBlogPosts(0, poet.helpers.options.postsPerPage, function (err, posts) {
      if (errorHandler(err, req, res)) return;
      res.render('blog/index', {
        page: 1,
        posts: posts,
        member: req.user,
        root: app.get('ROOT_URI'),
        static: true,
        blog: true,
        iutil: iutil,
        title: 'The Island | Blog'
      });
    });
  });

  // About
  // app.get('/about', _.bind(handler, undefined, function (req, res) {
  //   res.render('static', {
  //     key: 'about',
  //     title: 'About',
  //     body: 'Island is a group media blog with content cultivated by some of'
  //         + ' the world\'s best climbers. Our core Island Team is nearly'
  //         + ' 80 athletes strong.',
  //     root: app.get('ROOT_URI')
  //   });
  // }, 'folder'));

  // Contact
  // app.get('/contact', _.bind(handler, undefined, function (req, res) {
  //   res.render('static', {
  //     key: 'contact',
  //     title: 'Contact',
  //     body: '',
  //     root: app.get('ROOT_URI')
  //   });
  // }, 'folder'));

  // Privacy Policy
  app.get('/privacy', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'privacy',
      title: 'Privacy',
      body: 'This Privacy Policy governs the manner in which Island LLC'
          + ' collects, uses, maintains and discloses information collected'
          + ' from users (each, a "User") of the http://island.io website'
          + ' ("Site"). This privacy policy applies to the Site and all'
          + ' products and services offered by Island LLC.',
      root: app.get('ROOT_URI')
    });
  }, 'folder'));

  // Trending
  // Create some static content for the crawlers
  // app.get('/trending', _.bind(handler, undefined, function (req, res) {
  //   var items;
  //   Step(
  //     function () {

  //       // Get events.
  //       Events.feed({public: true}, ['view'], {limit: 10, cursor: 0},
  //           this.parallel());
  //       getPublicSidebarLists(this.parallel());
  //     },
  //     function (err, feed, publicLists) {
  //       if (errorHandler(err, req, res)) return;

  //       // Create some static content
  //       var html = '<h2>Public content now trending on The Island:</h2>';
  //       _.each(feed.events.items, function (i) {
  //         html += '<h3>' + i.action.name + '</h3>';
  //         if (i.action.description) {
  //           html += '<p>' + i.action.description;
  //           _.each(i.action.tags, function(t) {
  //             html += ' #' + t
  //           });
  //           html += '</p>';
  //         }
  //         html += '<a href="/' + i.action.author.username + '/views/'
  //              + i.action.slug + '/chart">';
  //         html += '<img class="event-view-image" src="'
  //              + i.action.staticImgUrl + '" alt="' + i.action.name + '">'
  //              + '</a>'
  //       });
  //       html += '<h2>Recently added ...:</h2>';
  //       _.each(publicLists.ticks.items, function (d) {
  //         html += '<a href="\/' + d.author.username + '\/' + d._id + '"> '
  //              + '<h3>' + d.title + '<\/h3>' + '<\/a>';
  //       });
  //       res.render('static', {
  //         key: 'trending',
  //         title: 'Trending Content',
  //         body: html,
  //         root: app.get('ROOT_URI')
  //       });

  //     }
  //   );
  // }, 'folder'));

  // Admin
  app.get('/admin', function (req, res) {
    if (!req.user || !req.user.admin) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', req, res);
  });

  // Settings
  app.get('/settings', function (req, res) {
    if (!req.user) {
      if (req.session) {
        req.session.referer = '/settings';
      }
      return res.redirect('/signin?post_signin=settings');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, 'folder', true, req, res);
  });

  // Reset
  app.get('/reset', function (req, res) {
    var parts = url.parse(req.url, true);
    var token = parts.query['t'];

    function _handle() {
      handler(function (req, res) {
        res.render('static', {root: app.get('ROOT_URI')});
      }, 'folder', true, req, res);
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
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Crag
  app.get('/crags/:y/:g', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g].join('/');

    // Get the crag.
    db.Crags.read({key: key}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;

      // Build head params.
      var title = [crag.name, crag.country].join(', ');
      var body = '';
      if (crag.bcnt > 0)
        body += '~' + _.numberFormat(crag.bcnt, 0) + ' boulders';
      if (crag.rcnt > 0) {
        if (body !== '') body += ', ';
        body += '~' + _.numberFormat(crag.rcnt, 0) + ' routes';
      }

      // Render.
      res.render('static', {
        key: 'crags/' + key,
        title: title,
        body: body,
        root: app.get('ROOT_URI')
      });
    });
  }, 'folder', true));

  // Ascents
  app.get('/crags/:y/:g/:t/:a', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');

    // Get the ascent.
    db.Ascents.read({key: key}, function (err, ascent) {
      if (errorHandler(err, req, res, ascent, 'ascent')) return;

      // Get ascent media.
      db.Medias.list({parent_id: ascent._id}, {sort: {created: -1}, limit: 20},
          function (err, medias) {
        if (errorHandler(err, req, res)) return;

        // Build head params.
        var title = ascent.name + ' - ' + [ascent.crag, ascent.country].join(', ');

        // Render.
        res.render('static', {
          key: 'crags/' + key,
          title: title,
          medias: medias,
          body: ascent.grades.sort().join(', '),
          root: app.get('ROOT_URI')
        });
      });
    });
  }, 'folder', true));

  // Video embeds
  app.get('/embed/:vid', function (req, res) {
    md = new MobileDetect(req.headers['user-agent']);

    // Find the media by id.
    db.Medias.read({'video.id': req.params.vid, $or: [{quality: {$exists:true}},
        {quality:{$exists:false}, old_parent_id: {$exists: true}}]},
        {inflate: {parent: profiles.post, old_parent: profiles.post}},
        function (err, med) {
      if (errorHandler(err, req, res, med, 'media')) return;

      // Get other qualities of this video.
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
        var streamer = 'http://players.edgesuite.net/flash/plugins/jw/v3.3'
            + '/AkamaiAdvancedJWStreamProvider.swf';
        var params = {sharing: {key: parent.key}};

        // Desktops and mobile tablets.
        if (!md.mobile() || (md.mobile() && md.tablet())) {
          _.extend(params, {
            playlist: [{
              image: hd.poster.ssl_url,
              sources: [{
                file: md.is('iOS') ?
                    ipad.video.ios_url: (ipad.video.import_url ?
                    ipad.video.ssl_url: ipad.video.streaming_url),
                provider: md.is('iOS') ? undefined: streamer,
                label: '1200k'
              },
              {
                file: md.is('iOS') ?
                    hd.video.ios_url: (hd.video.import_url ?
                    hd.video.ssl_url: hd.video.streaming_url),
                provider: md.is('iOS') ? undefined: streamer,
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
                file: md.is('iOS') ?
                    iphone.video.ios_url: (iphone.video.import_url ?
                    iphone.video.ssl_url: iphone.video.streaming_url),
                provider: md.is('iOS') ? undefined: streamer,
                label: '700k'
              },
              {
                file: md.is('iOS') ?
                    ipad.video.ios_url: (ipad.video.import_url ?
                    ipad.video.ssl_url: ipad.video.streaming_url),
                provider: md.is('iOS') ? undefined: streamer,
                label: '1200k'
              }]
            }]
          });
        }

        res.render('embed', {src: ipad.video.ssl_url,
            params: JSON.stringify(params)});
      });
    });
  });

  // Session permalink
  app.get('/sessions/:k', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Tick permalink
  app.get('/efforts/:k', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Ticks
  app.get('/:un/ascents', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }, 'folder', true));

  // Post permalink
  app.get('/:un/:k', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.un, req.params.k].join('/').toLowerCase();

    // Get the post.
    db.Posts.read({key: key}, {inflate: {author: profiles.member}},
        function (err, post) {
      if (errorHandler(err, req, res, post, 'post')) return;
      db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}},
          function (err) {
        if (errorHandler(err, req, res)) return;

        Step(
          function () {
            var vid = iutil.parseVideoURL(post.body);
            if (!vid) {
              return this();
            }

            // Get thumnail and poster.
            // TODO: Handle photos.
            if (vid.link.type === 'vimeo') {
              request.get({
                uri: 'https://vimeo.com/api/v2/video/' + vid.link.id + '.json',
                json: true
              }, _.bind(function (err, res, body) {
                if (err) return this(err);
                if (body.error) {
                  return this(body.error);
                }
                this(null, {poster: {
                  url: body[0].thumbnail_large,
                  meta: {width: 640, height: 360}
                }});
              }, this));
            } else if (vid.link.type === 'youtube') {
              this(null, {poster: {
                url: 'https://img.youtube.com/vi/' + vid.link.id + '/0.jpg',
                meta: {width: 480, height: 360}
              }});
              this();
            } else {
              this();
            }
          },
          function (err, link) {
            if (errorHandler(err, req, res)) return;

            // Render.
            var props = {
              key: post.key,
              title: [post.author.displayName, post.title].join(' - '),
              body: post.body,
              posts: [post],
              root: app.get('ROOT_URI')
            };
            if (link) {
              props.link = link;
            }
            res.render('static', props);
          }
        );
      });
    });
  }, 'folder', true));

  // Profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un.toLowerCase()}, 
        function (err, mem) {
      if (errorHandler(err, req, res, mem, 'profile')) return;
      db.Posts.list({author_id: mem._id}, {sort: {created: -1}, limit: 7},
          function (err, posts) {
        if (errorHandler(err, req, res)) return;
        db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
            function (err) {
          if (errorHandler(err, req, res)) return;

          // Get the body.
          var body;
          if (mem.description && mem.description !== '') {
            body = mem.description;
          }

          // Render.
          res.render('static', {
            key: mem.username,
            title: mem.displayName,
            body: body,
            posts: posts, 
            root: app.get('ROOT_URI')
          });
        });
      });
    });
  }, 'folder', true));

}
