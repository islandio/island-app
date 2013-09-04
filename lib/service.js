/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var url = require('url');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common.js');
var profiles = require('./resources').profiles;

// Define routes.
exports.routes = function (app) {

  /*
   * HTTP request handler.
   */
  function handler(stat, req, res) {

    // Handle the request statically if the user-agent
    // is from Facebook's url scraper or if specifically requested.
    var parts = url.parse(req.url, true);
    if (req.headers['user-agent'].indexOf('facebookexternalhit') !== -1
      || (parts.query['static'] === 'true'))
      return stat(req, res);

    // Handle the request normally.
    res.render('base', {member: req.user, root: app.get('ROOT_URI')});
  }

  //
  // JSON page profiles.
  //

  // Static profile
  app.get('/service/static.profile', function (req, res) {
    if (!req.user)
      return res.send(com.client({member: null, content: {page: null}}));

    if (req.query.n === '0')
      return res.send(com.client({
        member: req.user,
        content: {page: null},
        transloadit: app.get('transloadit')
      }));

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        member: req.user,
        transloadit: app.get('transloadit'),
        content: {page: null},
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

  });

  // Home profile
  app.get('/service/home.profile', function (req, res) {

    Step(
      function () {

        // Get posts and notifications.
        db.Posts.list({}, {sort: {created: -1}, limit: 3, inc: true,
            inflate: {author: profiles.member}},
            req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

      },
      function (err, posts, notes) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Fill posts.
            db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1},
                limit: 20}, this.parallel());
            db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, reverse: true, inflate: {author: profiles.member}},
                this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;
            var transloadit = req.user ? app.get('transloadit'): {};

            // Write profile.
            var profile = {
              member: req.user,
              transloadit: transloadit,
              content: {
                posts: {
                  cursor: 1,
                  more: posts && posts.length === 3,
                  items: posts
                }
              }
            };
            if (notes)
              profile.notes = {
                cursor: 1,
                more: notes.length === 5,
                items: notes
              };

            // Send profile.
            res.send(com.client(profile));
          }
        );

      }
    );

  });

  // Team profile
  app.get('/service/team.profile', function (req, res) {
    var query = {role: 0};
    var sort = {created: -1};

    Step(
      function () {

        // Get members and notifications.
        db.Members.list(query, {sort: sort, limit: 5},
            req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

      },
      function (err, mems, notes) {
        if (com.error(err, req, res)) return;
        var transloadit = req.user ? app.get('transloadit'): {};

        // Clean up.
        _.each(mems, function (mem) {
          delete mem.password;
          delete mem.salt;
          mem.gravatar = com.hash(mem.primaryEmail || 'foo@bar.baz');
        });

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit,
          content: {
            page: null,
            profiles: {
              cursor: 1,
              more: mems && mems.length === 5,
              items: mems,
              query: query,
              sort: sort
            }
          }
        };
        if (notes)
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  // Films profile
  app.get('/service/films.profile', function (req, res) {
    var query = {'product.sku': {$ne: null}};

    Step(
      function () {

        // Get posts and notifications.
        db.Posts.list(query, {sort: {created: -1}, limit: 3,
            inflate: {author: profiles.member}},
            req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

      },
      function (err, posts, notes) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Fill posts.
            db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1},
                limit: 20}, this.parallel());
            db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, reverse: true, inflate: {author: profiles.member}},
                this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;
            var transloadit = req.user ? app.get('transloadit'): {};

            // Write profile.
            var profile = {
              member: req.user,
              transloadit: transloadit,
              content: {
                page: null,
                posts: {
                  cursor: 1,
                  more: posts && posts.length === 3,
                  items: posts,
                  query: query
                }
              }
            };
            if (notes)
              profile.notes = {
                cursor: 1,
                more: notes.length === 5,
                items: notes
              };

            // Send profile.
            res.send(com.client(profile));
          }
        );

      }
    );

  });

  // Profiles
  app.get('/service/profile.profile/:un', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (com.error(err, req, res, mem, 'profile')) return;

      Step(
        function () {

          // Get posts and notifications.
          db.Posts.list({author_id: mem._id}, {sort: {created: -1}, limit: 3,
              inflate: {author: profiles.member}},
              req.user ? this.parallel(): this);
          if (req.user && req.query.n !== '0')
            db.Notifications.list({subscriber_id: req.user._id},
                {sort: {created: -1}, limit: 5,
                inflate: {event: profiles.event}}, this.parallel());

        },
        function (err, posts, notes) {
          if (com.error(err, req, res)) return;

          Step(
            function () {

              // Fill posts.
              db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1},
                  limit: 20}, this.parallel());
              db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
                  limit: 5, reverse: true, inflate: {author: profiles.member}},
                  this.parallel());
            },
            function (err) {
              if (com.error(err, req, res)) return;
              var transloadit = req.user ? app.get('transloadit'): {};

              // Write profile.
              delete mem.password;
              delete mem.salt;
              mem.gravatar = com.hash(mem.primaryEmail || 'foo@bar.baz');
              var profile = {
                member: req.user,
                transloadit: transloadit,
                content: {
                  page: mem,
                  posts: {
                    cursor: 1,
                    more: posts && posts.length === 3,
                    items: posts,
                    query: {author_id: mem._id}
                  }
                }
              };
              if (notes)
                profile.notes = {
                  cursor: 1,
                  more: notes.length === 5,
                  items: notes
                };

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
    if (!req.user)
      return res.send(com.client({member: null, content: {page: null}}));

    if (req.query.n === '0')
      return res.send(com.client({
        member: req.user,
        content: {page: req.user},
        transloadit: app.get('transloadit'),
      }));

    // Get notifications.
    db.Notifications.list({subscriber_id: req.user._id},
        {sort: {created: -1}, limit: 5,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Write and send profile.
      res.send(com.client({
        member: req.user,
        transloadit: app.get('transloadit'),
        content: {page: req.user},
        notes: {
          cursor: 1,
          more: notes.length === 5,
          items: notes
        }
      }));
    });

  });

  // Post profile
  app.get('/service/post.profile/:un/:k', function (req, res) {
    var key = [req.params.un, req.params.k].join('/');

    Step(
      function () {

        // Get post and notifications.
        db.Posts.read({key: key}, {inc: true,
            inflate: {author: profiles.member}},
            req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

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
          },
          function (err) {
            if (com.error(err, req, res)) return;
            var transloadit = req.user ? app.get('transloadit'): {};

            // Write profile.
            var profile = {
              member: req.user,
              transloadit: transloadit,
              content: {page: post}
            };
            if (notes)
              profile.notes = {
                cursor: 1,
                more: notes.length === 5,
                items: notes
              };

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

    Step(
      function () {

        // Get crag and notifications.
        db.Crags.read({key: key}, req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

      },
      function (err, crag, notes) {
        if (com.error(err, req, res, crag, 'crag')) return;

        // Get ascents.
        db.Ascents.list({crag_id: crag._id}, {sort: {name: 1}},
            function (err, ascents) {

          if (com.error(err, req, res)) return;
          var transloadit = req.user ? app.get('transloadit'): {};

          // Filter ascents by grade.
          crag.ascents = {};
          _.each(ascents, function (a) {
            _.each(a.grades, function (g) {
              if (!crag.ascents[a.type])
                crag.ascents[a.type] = {};
              if (crag.ascents[a.type][g])
                crag.ascents[a.type][g].push(a);
              else crag.ascents[a.type][g] = [a];
            });
          });

          // Write profile.
          var profile = {
            member: req.user,
            transloadit: transloadit,
            content: {page: crag}
          };
          if (notes)
            profile.notes = {
              cursor: 1,
              more: notes.length === 5,
              items: notes
            };

          // Send profile.
          res.send(com.client(profile));
        });

      }
    );

  });

  // Ascent profile
  app.get('/service/ascent.profile/:y/:g/:t/:a', function (req, res) {
    var key = [req.params.y, req.params.g,
        req.params.t, req.params.a].join('/');

    Step(
      function () {

        // Get ascent and notifications.
        db.Ascents.read({key: key}, req.user ? this.parallel(): this);
        if (req.user && req.query.n !== '0')
          db.Notifications.list({subscriber_id: req.user._id},
              {sort: {created: -1}, limit: 5,
              inflate: {event: profiles.event}}, this.parallel());

      },
      function (err, ascent, notes) {
        if (com.error(err, req, res, ascent, 'ascent')) return;
        var transloadit = req.user ? app.get('transloadit'): {};

        // Write profile.
        var profile = {
          member: req.user,
          transloadit: transloadit,
          content: {page: ascent}
        };
        if (notes)
          profile.notes = {
            cursor: 1,
            more: notes.length === 5,
            items: notes
          };

        // Send profile.
        res.send(com.client(profile));
      }
    );

  });

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', _.bind(handler, undefined, function (req, res) {

    // List post images.
    db.Posts.list({}, {sort: {created: -1}, limit: 5}, function (err, posts) {
      if (com.error(err, req, res)) return;
      db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
          function (err) {
        if (com.error(err, req, res)) return;

        // Render.
        res.render('static', {
          body: 'Island is a group media blog with content cultivated by some of'
              + ' the world\'s best climbers. Our core Island Team is nearly'
              + ' 80 athletes strong.',
          posts: posts, 
          root: app.get('ROOT_URI')
        });
      });
    });
  }));

  // Team
  app.get('/team', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'team',
      title: 'Team',
      body: '',
      root: app.get('ROOT_URI')
    });
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

  // Contact
  app.get('/contact', _.bind(handler, undefined, function (req, res) {
    res.render('static', {
      key: 'contact',
      title: 'Contact',
      body: '',
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

  // Logout
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  //
  // Dynamic URL HTML pages.
  //

  // Crags
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

      // Build head params.
      var title = ascent.name + ' - ' + [ascent.crag, ascent.country].join(', ');

      // Render.
      res.render('static', {
        key: 'crags/' + key,
        title: title,
        body: ascent.grades.sort().join(', '),
        root: app.get('ROOT_URI')
      });
    });
  }));

  // Post permalink
  app.get('/:un/:k', _.bind(handler, undefined, function (req, res) {
    var key = [req.params.un, req.params.k].join('/');

    // Get the post.
    db.Posts.read({key: key}, {inflate: {author: profiles.member}},
        function (err, post) {
      if (com.error(err, req, res, post, 'post')) return;
      db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}, limit: 20},
          function (err) {
        if (com.error(err, req, res)) return;

        // Render.
        res.render('static', {
          key: post.key,
          title: [post.author.displayName, post.title].join(' - '),
          body: post.body,
          posts: [post],
          root: app.get('ROOT_URI')
        });
      });
    });
  }));

  // Profile
  app.get('/:un', _.bind(handler, undefined, function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, mem) {
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
