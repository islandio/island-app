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

// Define routes.
exports.routes = function (app) {

  //
  // JSON page profiles.
  //

  // Home profile
  app.get('/service/home.profile', function (req, res) {

    // Get posts.
    db.Posts.list({}, {sort: {created: -1}, limit: 10,
        inflate: {
          member: ['username', 'displayName']
        }}, function (err, posts) {
      if (com.error(err, req, res)) return;

      Step(
        function () {

          // Fill posts.
          db.fill(posts, 'Medias', 'post_id', {sort: {created: -1}},
              this.parallel());
          db.fill(posts, 'Comments', 'post_id', {sort: {created: -1},
              inflate: {member: ['username', 'displayName']}},
              this.parallel());
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({
            member: req.user,
            content: {
              posts: {
                cursor: 1,
                items: posts
              }
            }
          }));
        }
      );

    });
  });

  // Member profile
  app.get('/service/member.profile', function (req, res) {

    // Get the member.
    db.Members.read({username: req.body.username}, function (err, mem) {
      if (com.error(err, req, res, mem, 'member')) return;

      // Get comments and posts.
      Step(
        function () {
          db.Comments.list({member_id: mem._id}, {sort: {created: -1},
              limit: 10, inflate: {member: ['username', 'displayName'],
              post: ['key', 'title']}}, this.parallel());
          db.Posts.list({member_id: mem._id}, {sort: {created: -1},
              limit: 5, inflate: {member: ['username', 'displayName']}},
              this.parallel());
        },
        function (err, comments, posts) {
          if (com.error(err, req, res)) return;

          // Get the media for the posts.
          db.fill(posts, 'Medias', 'post_id', {sort: {created: -1}},
              function (err, posts) {

            // Send profile.
            res.send(com.client({
              member: req.user,
              content: {
                member: mem,
                comments: {
                  cursor: 1,
                  items: comments
                },
                posts: {
                  cursor: 1,
                  items: posts
                }
              }
            }));

          });

        }
      );
    });

  });

  //
  // HTML pages.
  //

  // Home
  app.get('/', function (req, res) {
    res.render('home', {
      title: 'You\'re Island',
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
    // Step(
    //   function () {
    //     memberDb.findPosts({'product.sku': {$ne: null}}, this);
    //   },
    //   function (err, posts) {
    //     _.each(posts, function (post) {
    //       var img = [];
    //       var vid = [];
    //       var aud = [];
    //       _.each(post.medias, function (med) {
    //         var rating = req.user ? _.find(med.ratings, function (rat) {
    //           return req.user._id.toString() === rat.member_id.toString();
    //         }) : null;
    //         med.hearts = rating ? rating.val : 0;
    //         delete med.ratings;
    //         switch (med.type) {
    //           case 'image': img.push(med); break;
    //           case 'video': vid.push(med); break;
    //           case 'audio':
    //             aud.push(med);
    //             med.audioIndex = aud.length;
    //             break;
    //         }
    //       });
    //       post.medias = [].concat(img, aud, vid);
    //     });
    //     res.render('films', {
    //       title: 'Island - Films',
    //       films: posts,
    //       member: req.user,
    //       twitters: twitterHandles,
    //       util: templateUtil
    //     });
    //   }
    // );
  });
  app.get('/film', function (req, res) {
    res.redirect('/films');
  });

  // Explore
  app.get('/explore', function (req, res) {
    res.render('explore', { title: 'Explore'});
  });

  // Privacy Policy
  app.get('/privacy', function (req, res) {
    res.render('privacy', { title: 'Privacy Policy'});
  });

  // Member profile
  app.get('/:username', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.username}, function (err, mem) {
      if (com.error(err, req, res, mem, 'member')) return;
      res.render('profile', {
        title: mem.displayName,
        member: req.user,
        data: mem
      });
    });

  });

}