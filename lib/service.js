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
            db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
                this.parallel());
            db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
                inflate: {author: profiles.member}},
                this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Write profile.
            var profile = {
              member: req.user,
              transloadit: req.user && req.user.role === 0 ? app.get('transloadit'): {},
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

  // Post profile
  app.get('/service/post.profile/:username/:key', function (req, res) {
    var key = [req.params.username, req.params.key].join('/');

    // Get comments and posts.
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
            db.fill(post, 'Medias', 'parent_id', {sort: {created: -1}},
                this.parallel());
            db.fill(post, 'Comments', 'parent_id', {sort: {created: -1},
                inflate: {author: profiles.member}},
                this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Write profile.
            var profile = {
              member: req.user,
              transloadit: req.user && req.user.role === 0 ? app.get('transloadit'): {},
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

      // Get comments and posts.
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
              db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
                  this.parallel());
              db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
                  inflate: {author: profiles.member}},
                  this.parallel());
            },
            function (err) {
              if (com.error(err, req, res)) return;

              // Write profile.
              var profile = {
                member: req.user,
                transloadit: req.user && req.user.role === 0 ? app.get('transloadit'): {},
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

  //
  // Static URL HTML pages.
  //

  // Home
  app.get('/', function (req, res) {
    res.render('home', {
      title: 'Island | Climb',
      member: req.user
    });
  });

  // Login
  app.get('/login', function (req, res) {
    if (req.session.passport.user)
      return res.redirect('/');
    var opts = {
      session: req.session.temp,
      title: 'You\'re Island',
      login: true,
    };
    delete req.session.temp;
    res.render('login', opts);
  });

  // Logout
  app.get('/logout', function (req, res) {
    req.logOut();
    res.redirect('/login');
  });

  // Films
  app.get('/films', function (req, res) {
    
    // db.Posts.list({'product.sku': {$ne: null}}, {sort: {created: -1},
    //     inflate: {author: profiles.member}}, function (err, posts) {
    //   if (com.error(err, req, res)) return;

    //   Step(
    //     function () {

    //       // Fill posts.
    //       db.fill(posts, 'Medias', 'parent_id', {sort: {created: -1}},
    //           this.parallel());
    //       db.fill(posts, 'Comments', 'parent_id', {sort: {created: -1},
    //           inflate: {author: profiles.member}},
    //           this.parallel());
    //     },
    //     function (err) {
    //       if (com.error(err, req, res)) return;

    //       // Send profile.
    //       res.send(com.client({
    //         member: req.user,
    //         content: {
    //           page: mem,
    //           posts: {
    //             cursor: 1,
    //             more: posts && posts.length === 3,
    //             items: posts,
    //             query: {author_id: mem._id}
    //           },
    //           notes: {
    //             cursor: 1,
    //             more: notes && notes.length === 5,
    //             items: notes
    //           }
    //         }
    //       }));
    //     }
    //   );

    // });

    // res.render('films', {
    //   title: 'Island | Films',
    //   films: posts,
    //   member: req.user
    // });

  });
  app.get('/film', function (req, res) {
    res.redirect('/films');
  });

  // Privacy Policy
  app.get('/privacy', function (req, res) {
    res.render('privacy', { title: 'Privacy Policy'});
  });

  //
  // Dynamic URL HTML pages.
  //

  // Post
  app.get('/:username/:key', function (req, res) {
    res.render('post', {
      title: 'Island',
      member: req.user
    });
  });  

  // Member profile
  app.get('/:username', function (req, res) {

    res.render('profile', {
      title: 'Island | ppp',
      member: req.user
    });    

    // Get the member.
    // db.Members.read({username: req.params.username}, function (err, mem) {
    //   if (com.error(err, req, res, mem, 'member')) return;
    //   res.render('profile', {
    //     title: mem.displayName,
    //     member: req.user,
    //     data: mem
    //   });
    // });

  });

}
