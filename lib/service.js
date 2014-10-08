/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var request = require('request');
var url = require('url');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var MobileDetect = require('mobile-detect');
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;
var Events = require('./resources/event');
var Crags = require('./resources/crag');

// Define routes.
exports.routes = function (app) {

  /*
   * HTTP request handler.
   */
  function handler(stat, req, res) {

    // Handle the request statically if the user-agent
    // is from Facebook's url scraper or if specifically requested.
    var parts = url.parse(req.url, true);
    if (parts.query['static'] === 'true' || (req.headers
        && req.headers['user-agent'].indexOf('facebookexternalhit') !== -1)) {
      return stat(req, res);
    }

    // Handle the request normally.
    res.render('base', {member: req.user, root: app.get('ROOT_URI')});
  }

  /*
   * Pull requested event action types from request.
   */
  function parseEventActions(req, types) {
    var query = url.parse(req.url, true).query;
    var type = query['actions'];
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
    if (!member) {
      return cb(null, {});
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

        // Sort watchees.
        var watchees = [].concat(crags, ascents).sort(function (a, b) {
          return b.created - a.created;
        });

        cb(err, {
          followers: {items: followers},
          followees: {items: followees},
          watchees: {items: watchees},
          ticks: {items: ticks}
        });
      }
    );
  }

  /*
   * Return transloadit params.
   */
  function transloadit(req) {
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

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static.profile', function (req, res) {
    
    Step(
      function () {
        if (!req.user) {
          return this();
        }

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Get notifications.
        if (req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, lists, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {page: null})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Dashboard profile
  app.get('/service/dashboard.profile', function (req, res) {
    if (!req.user) {
      return res.send(com.client({member: req.user, content: {}}));
    }
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['session', 'post']);
    
    Step(
      function () {

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Get events and notifications.
        Events.feed({subscriber_id: req.user._id}, actions,
            {limit: limit, cursor: cursor}, this.parallel());

        // Get Notifications.
        db.Notifications.list({subscriber_id: req.user._id},
            {sort: {created: -1}, limit: 5,
            inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, lists, events, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {events: events})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // User sessions profile
  app.get('/service/sessions.profile', function (req, res) {
    if (!req.user) {
      return res.send(com.client({member: req.user, content: {}}));
    }
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    
    Step(
      function () {

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Get events and notifications.
        Events.feed({subscribee_id: req.user._id}, ['session'],
            {limit: limit, cursor: cursor}, this.parallel());
        
        // Get Notifications.
        db.Notifications.list({subscriber_id: req.user._id},
            {sort: {created: -1}, limit: 5,
            inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, lists, events, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {events: events})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // User ticks profile
  app.get('/service/ticks.profile', function (req, res) {
    if (!req.user) {
      return res.send(com.client({member: req.user, content: {}}));
    }
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;

    Step(
      function () {

        // Get sidebar.
        getSidebarLists(req.user, req.user, this.parallel());

        // Get ticks.
        db.Ticks.list({author_id: req.user._id, sent: true},
            {inflate: {ascent: profiles.ascent}, sort: {created: -1}},
            this.parallel());

        // Get Notifications.
        db.Notifications.list({subscriber_id: req.user._id},
            {sort: {created: -1}, limit: 5,
            inflate: {event: profiles.event}}, this.parallel());
      },
      function (err, lists, ticks, notes) {
        if (com.error(err, req, res)) return;

        // Sort ticks by type.
        ticks = _.groupBy(ticks, 'type');

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {page: {ticks: ticks}})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Session profile
  app.get('/service/session.profile/:key', function (req, res) {

    Step(
      function () {

        // Get session and notifications.
        db.Sessions.read({key: req.params.key},
            {inflate: {author: profiles.member, crag: profiles.crag}},
            req.user ? this.parallel(): this);

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, session, notes) {
        if (com.error(err, req, res, session, 'session')) return;

        Step(
          function () {

            // Fill comments.
            db.fill(session, 'Comments', 'parent_id', {sort: {created: -1},
                reverse: true, inflate: {author: profiles.member}},
                this.parallel());

            // Fill hangtens.
            db.fill(session, 'Hangtens', 'parent_id', this.parallel());

            // Fill actions.
            db.fill(session, 'Actions', 'session_id', {sort: {index: 1}},
                this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Fill ticks.
            db.fill(session.actions, 'Ticks', 'action_id', {sort: {index: 1},
                inflate: {ascent: profiles.ascent}}, this);
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Write profile.
            var profile = {
              member: req.user,
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
            res.send(com.client(profile));
          }
        );

      }
    );

  });

  // New Session profile
  app.get('/service/session.new.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({member: null, content: {page: null}}));

    Step(
      function () {

        // Get sidebar.
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
      function (err, lists, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {page: null})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Post profile
  app.get('/service/post.profile/:un/:k', function (req, res) {
    var key = [req.params.un, req.params.k].join('/').toLowerCase();

    Step(
      function () {

        // Get post and notifications.
        db.Posts.read({key: key}, {inflate: {author: profiles.member}},
            req.user ? this.parallel(): this);

        if (req.user && req.query.n !== '0') {
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());
        }
      },
      function (err, post, notes) {
        if (com.error(err, req, res, post, 'post')) return;

        Step(
          function () {

            // Fill post.
            db.fill(post, 'Medias', 'parent_id', {sort: {created: -1},
                limit: 20}, this.parallel());
            db.fill(post, 'Comments', 'parent_id', {sort: {created: -1},
                reverse: true, inflate: {author: profiles.member}},
                this.parallel());
            db.fill(post, 'Hangtens', 'parent_id', this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Write profile.
            var profile = {
              member: req.user,
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
            res.send(com.client(profile));
          }
        );

      }
    );

  });

  // Crag profile
  app.get('/service/crag.profile/:y/:g', function (req, res) {
    var key = [req.params.y, req.params.g].join('/');
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['session', 'post']);

    db.Crags.read({key: key, forbidden: {$ne: true}}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

      Step(
        function () {

          // Get lists.
          Events.feed({subscribee_id: crag._id}, actions,
              {limit: limit, cursor: cursor}, this.parallel());
          db.Ascents.list({crag_id: crag._id}, {sort: {name: 1}}, this.parallel());

          // Get follow status.
          if (req.user) {
            db.Subscriptions.read({subscribee_id: crag._id,
                subscriber_id: req.user._id, 'meta.style': 'watch'},
                this.parallel());
          }

          // Get notifications.
          if (req.user && req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, events, ascents, sub, notes) {
          if (com.error(err, req, res)) return;

          // Filter ascents by grade.
          crag.ascents = {};
          _.each(ascents, function (a) {
            _.each(a.grades, function (g) {
              if (!crag.ascents[a.type]) {
                crag.ascents[a.type] = {};
              }
              if (crag.ascents[a.type][g]) {
                crag.ascents[a.type][g].push(a);
              } else {
                crag.ascents[a.type][g] = [a];
              }
            });
          });

          // Write profile.
          var profile = {
            member: req.user,
            sub: sub,
            transloadit: transloadit(req),
            content: {
              page: crag,
              events: events
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
          res.send(com.client(profile));
        }
      );
    });

  });

  // Ascent profile
  app.get('/service/ascent.profile/:y/:g/:t/:a', function (req, res) {
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['tick', 'post']);

    // Get the ascent.
    db.Ascents.read({key: key}, function (err, ascent) {
      if (com.error(err, req, res, ascent, 'ascent')) return;

      Step(
        function () {

          // Get lists.
          Events.feed({subscribee_id: ascent._id}, actions,
              {limit: limit, cursor: cursor}, this.parallel());

          // Get follow status.
          if (req.user) {
            db.Subscriptions.read({subscribee_id: ascent._id,
                subscriber_id: req.user._id, 'meta.style': 'watch'},
                this.parallel());
          }

          // Get notifications.
          if (req.user && req.query.n !== '0') {
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());
          }
        },
        function (err, events, sub, notes) {
          if (com.error(err, req, res)) return;

          // Write profile.
          var profile = {
            member: req.user,
            sub: sub,
            transloadit: transloadit(req),
            content: {
              page: ascent,
              events: events
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
          res.send(com.client(profile));
        }
      );
    });

  });

  // Crags profile
  app.get('/service/crags.profile', function (req, res) {
    var params = {query: req.query.query, country: req.query.country};

    Step(
      function () {
        if (!req.user && !params.query && !params.country) {
          return this();
        }

        // Get crags.
        if (params.query || params.country) {
          Crags.find(params, this.parallel());
        }

        // Get sidebar.
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
      function (err, crags, lists, notes) {
        if (com.error(err, req, res)) return;
        if (!params.query && !params.country) {
          notes = lists;
          lists = crags;
          crags = false;
        }

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {page: null, crags: crags})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Films profile
  app.get('/service/films.profile', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;

    Step(
      function () {

        // Get events.
        var query = {action: {type: 'post', query: {'product.sku': {$ne: null}}}};
        Events.feed(query, ['post'], {limit: limit, cursor: cursor},
            this.parallel());

        // Get sidebar.
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
      function (err, events, lists, notes) {
        if (com.error(err, req, res)) return;

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit(req),
          content: _.extend(lists, {page: null, events: events})
        };
        if (notes) {
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };
        }

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Profiles
  app.get('/service/profile.profile/:un', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var actions = parseEventActions(req, ['session', 'post']);

    // Get the member.
    db.Members.read({username: req.params.un.toLowerCase()},
        function (err, mem) {
      if (com.error(err, req, res, mem, 'profile')) return;

      var own = req.user && req.user._id.toString() === mem._id.toString();
      Step(
        function () {

          // Get follow status.
          if (req.user && req.user._id.toString() !== mem._id.toString()) {
            db.Subscriptions.read({subscribee_id: mem._id,
                subscriber_id: req.user._id}, this);
          } else {
            this();
          }
        },
        function (err, sub) {
          if (com.error(err, req, res)) return;
          var feed = mem.config.privacy.mode.toString() === '0'
              || (sub && sub.meta.style === 'follow') || own;

          Step(
            function () {

              // Get sidebar.
              getSidebarLists(mem, req.user, this.parallel());

              // Get events.
              if (feed) {
                Events.feed({subscribee_id: mem._id}, actions,
                    {limit: limit, cursor: cursor}, this.parallel());
              }

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
            function (err, lists, events, team, notes) {
              if (com.error(err, req, res)) return;
              if (!feed) {
                team = events;
                notes = team;
                events = {items: []};
              }
              if (mem.role !== 2) {
                notes = team;
                team = false;
              }

              // Clean up team docs.
              if (team) {
                _.each(team, function (m) {
                  delete m.password;
                  delete m.salt;
                  m.gravatar = com.hash(m.primaryEmail || 'foo@bar.baz');
                });
                mem.team = team;
              }

              // Write profile.
              delete mem.password;
              delete mem.salt;
              mem.gravatar = com.hash(mem.primaryEmail || 'foo@bar.baz');
              var profile = {
                member: req.user,
                sub: sub,
                transloadit: transloadit(req),
                content: _.extend(lists, {
                  page: mem,
                  events: events,
                  private: !feed
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
              res.send(com.client(profile));
            }
          );
        }
      );
    });
  });

  // Settings profile
  app.get('/service/settings.profile', function (req, res) {
    if (!req.user) {
      return res.send(com.client({member: null, content: {page: null}}));
    }

    if (req.query.n === '0') {
      return res.send(com.client({
        member: req.user,
        content: {page: req.user},
        transloadit: transloadit(req),
      }));
    }

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Write and send profile.
      res.send(com.client({
        member: req.user,
        transloadit: transloadit(req),
        content: {page: req.user},
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Blank
  app.get('/_blank', function (req, res) { res.render('blank'); });
  app.post('/_blank', function (req, res) { res.render('blank'); });

  // Signin
  app.get('/signin', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Signup
  app.get('/signup', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Sessions
  app.get('/sessions', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // New Session
  app.get('/sessions/new', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Ticks
  app.get('/ticks', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Crags
  app.get('/crags', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Films
  app.get('/films', _.bind(handler, undefined, function (req, res) {
    
    // List film post images.
    db.Posts.list({'product.sku': {$ne: null}}, {sort: {created: -1}, limit: 5},
        function (err, posts) {
      if (com.error(err, req, res)) return;
      db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
          function (err) {
        if (com.error(err, req, res)) return;

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
  }));

  // About
  app.get('/about', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'about',
      title: 'About',
      body: 'Island is a group media blog with content cultivated by some of'
          + ' the world\'s best climbers. Our core Island Team is nearly'
          + ' 80 athletes strong.',
      root: app.get('ROOT_URI')
    });
  }));

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
  }));

  // Settings
  app.get('/settings', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });
  app.get('/settings/:k', function (req, res) {

    // If there is no user, try a login from the key.
    // (these come from emails)
    if (!req.user) {
      db.Keys.read({_id: db.oid(req.params.k)}, function (err, key) {
        if (com.error(err, req, res)) return;
        if (!key) return res.redirect('/');

        // Get the user for the key.
        db.Members.read({_id: key.member_id}, function (err, mem) {
          if (com.error(err, req, res)) return;
          if (!mem) return res.redirect('/');

          // Login.
          req.login(mem, function (err) {
            if (com.error(err, req, res)) return;
            res.redirect('/settings');
          });
        });
      });
    } else res.redirect('/settings');
  });

  // Reset
  app.get('/reset', function (req, res) {
    var parts = url.parse(req.url, true);
    var token = parts.query['t'];

    function _handle() {
      handler(function (req, res) {
        res.render('static', {root: app.get('ROOT_URI')});
      }, req, res);
    }

    // Check for token.
    if (token)
      db.Keys.read({_id: db.oid(token)}, function (err, key) {
        if (com.error(err, req, res)) return;
        if (!key) return res.redirect('/');

        // Get the user for the key.
        db.Members.read({_id: key.member_id}, function (err, mem) {
          if (com.error(err, req, res)) return;
          if (!mem) return res.redirect('/');

          // Attach the token to the session
          // so we can grab it later and verify.
          req.session.reset_token = token;

          // Handoff to the front-end.
          _handle();
        });
      });
    else if (req.user) _handle();
    else res.redirect('/');
  });

  // Logout
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // Crags
  app.get('/crags/:y', _.bind(handler, undefined, function (req, res) {
    res.render('static', {root: app.get('ROOT_URI')});
  }));

  // Crag
  app.get('/crags/:y/:g', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g].join('/');

    // Get the crag.
    db.Crags.read({key: key}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

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
  }));

  // Ascents
  app.get('/crags/:y/:g/:t/:a', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');

    // Get the ascent.
    db.Ascents.read({key: key}, function (err, ascent) {
      if (com.error(err, req, res, ascent, 'ascent')) return;

      // Get ascent media.
      db.Medias.list({parent_id: ascent._id}, {sort: {created: -1}, limit: 20},
          function (err, medias) {
        if (com.error(err, req, res)) return;

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
  }));

  // Session permalink
  app.get('/sessions/:k', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Tick permalink
  app.get('/ticks/:k', function (req, res) {
    if (!req.user) return res.redirect('/');
    handler(function (req, res) {
      res.render('static', {root: app.get('ROOT_URI')});
    }, req, res);
  });

  // Video embeds
  app.get('/embed/:vid', function (req, res) {
    md = new MobileDetect(req.headers['user-agent']);

    // Find the media by id.
    db.Medias.read({'video.id': req.params.vid, $or: [{quality: {$exists:true}},
        {quality:{$exists:false}, old_parent_id: {$exists: true}}]},
        {inflate: {parent: profiles.post, old_parent: profiles.post}},
        function (err, med) {
      if (com.error(err, req, res, med, 'media')) return;

      // Get other qualities of this video.
      var qualities = _.reject(['iphone', 'ipad', 'hd'], function (q) {
        return q === med.quality;
      });
      var pid = med.parent ? med.parent._id:
          (med.old_parent ? med.old_parent._id: false);
      if (!pid)
        return com.error(undefined, req, res, undefined, 'media');
      db.Medias.list({parent_id: pid, type: 'video',
          quality: {$in: qualities}}, function (err, meds) {
        if (com.error(err, req, res)) return;
        if (meds.length === 0)
          return com.error(undefined, req, res, undefined, 'media');
        var parent = med.parent || med.old_parent;

        // Gather videos.
        if (med.quality) meds.push(med);
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

  // Post permalink
  app.get('/:un/:k', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.un, req.params.k].join('/').toLowerCase();

    // Get the post.
    db.Posts.read({key: key}, {inflate: {author: profiles.member}},
        function (err, post) {
      if (com.error(err, req, res, post, 'post')) return;
      db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
          function (err) {
        if (com.error(err, req, res)) return;

        Step(
          function () {
            var vid = com.parseVideoURL(post.body);
            if (!vid) return this();

            // Get thumnail and poster.
            // TODO: Handle photos.
            if (vid.link.type === 'vimeo') {
              request.get({
                uri: 'https://vimeo.com/api/v2/video/' + vid.link.id + '.json',
                json: true
              }, _.bind(function (err, res, body) {
                if (err) return this(err);
                if (body.error) return this(body.error);
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
            } else this();
          },
          function (err, link) {
            if (com.error(err, req, res)) return;

            // Render.
            var props = {
              key: post.key,
              title: [post.author.displayName, post.title].join(' - '),
              body: post.body,
              posts: [post],
              root: app.get('ROOT_URI')
            };
            if (link) props.link = link;
            res.render('static', props);
          }
        );
      });
    });

  }));

  // Profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un.toLowerCase()}, 
        function (err, mem) {
      if (com.error(err, req, res, mem, 'profile')) return;
      db.Posts.list({author_id: mem._id}, {sort: {created: -1}, limit: 7},
          function (err, posts) {
        if (com.error(err, req, res)) return;
        db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
            function (err) {
          if (com.error(err, req, res)) return;

          // Get the body.
          var body;
          if (mem.description && mem.description !== '')
            body = mem.description;

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
  }));

}
