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

/*
 * Error wrap JSON request.
 */
function error(err, req, res, data, estr) {
  if (typeof data === 'string') {
    estr = data;
    data = null;
  }
  var fn = req.xhr ? res.send: res.render;
  if (err) {
    fn.call(res, 500, {error: 'server error'});
    return true;
  } else if (!data && estr) {
    fn.call(res, 404, {error: estr + ' not found'});
    return true;
  } else return false;
}

/*
 * Prepare obj for client.
 * - replace ObjectsIDs with strings.
 */
function client(obj) {
  _.each(obj, function (att, n) {
    if (_.isObject(att) && att._id) {
      att.id = att._id.toString();
      delete att._id;
      client(att);
    } else if (_.isObject(att) || _.isArray(att))
      client(att);
  });
  return obj;
}

// Define routes.
exports.routes = function (app) {

  //
  // JSON page profiles.
  //

  // Home profile
  app.post('/service/home.profile', function (req, res) {

    // Get comments and posts.
    Step(
      function () {
        db.Comments.list({},
            {sort: {created: -1}, limit: 10, inflate: true,
            ensure: ['member', 'post']}, this.parallel());
        db.Posts.list({},
            {sort: {created: -1}, limit: 5, inflate: true,
            ensure: ['member']}, this.parallel());
      },
      function (err, comments, posts) {
        if (error(err, req, res)) return;

        // Get the media for the posts.
        db.fill(posts, 'Medias', 'post_id', {sort: {created: -1}},
            function (err, posts) {

          // Send profile.
          res.send(client({
            member: req.user,
            content: {
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

  // Member profile
  app.post('/service/member.profile', function (req, res) {

    // Get the member.
    db.Members.read({username: req.body.username}, function (err, mem) {
      if (error(err, req, res, mem, 'member')) return;

      // Get comments and posts.
      Step(
        function () {
          db.Comments.list({member_id: mem._id},
              {sort: {created: -1}, limit: 10, inflate: true,
              ensure: ['member', 'post']}, this.parallel());
          db.Posts.list({member_id: mem._id},
              {sort: {created: -1}, limit: 5, inflate: true,
              ensure: ['member']}, this.parallel());
        },
        function (err, comments, posts) {
          if (error(err, req, res)) return;

          // Get the media for the posts.
          db.fill(posts, 'Medias', 'post_id', {sort: {created: -1}},
              function (err, posts) {

            // Send profile.
            res.send(client({
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
      if (error(err, req, res, mem, 'member')) return;
      res.render('profile', {
        title: mem.displayName,
        member: req.user,
        data: mem
      });
    });

  });

}