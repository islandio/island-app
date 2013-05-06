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

  // Member profile
  app.post('/service/member.profile', function (req, res) {

    // Get the member.
    db.Members.read({username: req.body.username}, function (err, mem) {
      if (error(err, req, res, mem, 'member')) return;

      Step(
        function () {
          db.Comments.list({member_id: mem._id},
              {sort: {created: -1}, limit: 10, inflate: true,
              ensure: ['member', 'post']}, this.parallel());
          db.Posts.list({member_id: mem._id},
              {sort: {created: -1}, limit: 10, inflate: true,
              ensure: ['member']}, this.parallel());
        },
        function (err, comments, posts) {
          if (error(err, req, res)) return;

          db.fill(posts, 'Medias', 'post_id', function (err, posts) {

            // Send profile.
            res.send(client({
              member: req.session.user,
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

  // Member profile
  app.get('/:username', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.username}, function (err, doc) {
      if (error(err, req, res, doc, 'member')) return;
      res.render('profile', {
        title: doc.displayName,
        member: req.session.user,
        data: doc
      });
    });

  });

}