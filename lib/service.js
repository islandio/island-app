/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common.js');
var profiles = require('./resources').profiles;

// Define routes.
exports.routes = function (app) {

  //
  // JSON page profiles.
  //

  // Home profile
  app.get('/service/home.profile', function (req, res) {

    Step(
      function () {

        // Get posts and notifications.
        db.Posts.list({}, {sort: {created: -1}, limit: 3,
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

  // Post profile
  app.get('/service/post.profile/:un/:k', function (req, res) {
    var key = [req.params.un, req.params.k].join('/');

    Step(
      function () {

        // Get post and notifications.
        db.Posts.read({key: key}, {inflate: {author: profiles.member}},
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

  // Member profile
  app.get('/service/member.profile/:un', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (com.error(err, req, res, mem, 'member')) return;

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
  app.get('/', function (req, res) {
    res.render('base', {member: req.user});
  });

  // Setings
  app.get('/settings', function (req, res) {
    if (!req.user) return res.redirect('/');
    res.render('base', {member: req.user});
  });

  // Films
  app.get('/films', function (req, res) {
    res.render('base', {member: req.user});
  });

  // Privacy Policy
  app.get('/privacy', function (req, res) {
    res.render('privacy', {title: 'Privacy Policy'});
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
  app.get('/crags/:y/:g', function (req, res) {
    res.render('base', {member: req.user});
  });

  // Ascents
  app.get('/crags/:y/:g/:t/:a', function (req, res) {
    res.render('base', {member: req.user});
  });

  // Post permalink
  app.get('/:un/:k', function (req, res) {
    res.render('base', {member: req.user});
  });

  // Member profile
  app.get('/:un', function (req, res) {
    res.render('base', {member: req.user});
  });

}
