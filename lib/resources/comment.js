/*
 * comment.js: Handling for the comment resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db.js');
var authorize = require('./member.js').authorize;
var com = require('../common.js');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <ObjectId>,
    "body": <String>,
    "likes": <Number>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
}
*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // list
  app.post('/api/comments/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = {};

    if (req.body.author_id) query.author_id = db.oid(req.body.author_id);
    if (req.body.parent_id) query.parent_id = db.oid(req.body.parent_id);

    db.Comments.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor}, function (err, comments) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        comments: {
          cursor: ++cursor,
          more: comments && comments.length === limit,
          items: comments
        }
      }));

    });

  });

  // create
  app.post('/api/comments/:type', function (req, res) {
    if (!req.body.body || req.body.body === ''
        || !req.body.parent_id)
      return res.send(403, {error: 'Comment invalid'});

    if (!req.user || !req.user.confirmed)
      return res.send(403, {error: 'Member invalid'});

    var type = req.params.type;
    var resource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;

    // Get the comment's parent.
    // TODO: handle parents w/ out authors.
    db[resource].read({_id: db.oid(props.parent_id)},
        {inflate: {author: profiles.member}}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      // Create the comment.
      props.parent_id = parent._id;
      db.Comments.create(props, {inflate: {author: profiles.member}},
          function (err, doc) {
        if (com.error(err, req, res)) return;

        // Notify subscribers of event.
        pubsub.notify({actor_id: req.user._id, target_id: parent._id,
            action_id: doc._id, data: {
          action: {
            a: req.user.displayName,
            g: req.user.gravatar,
            t: 'comment',
            b: doc.body
          },
          target: {
            a: parent.author.displayName,
            n: parent.title,
            t: type,
            s: parent.key
          }
        }});

        // Subscribe actor to future events.
        pubsub.subscribe(req.user, parent, {style: 'watch', type: type});

        // Publish comment.
        pubsub.publish(type + '-' + parent._id.toString(), 'comment.new', doc);

        res.send({id: doc._id.toString()});
      });
    });

  });

  // read
  app.get('/api/comments/:id', function (req, res) {


  });

  // update
  app.put('/api/comments/:id', function (req, res) {


  });

  // delete
  app.delete('/api/comments/:id', function (req, res) {


  });

  // app.delete('/comment/:id', authorize, function (req, res) {
  //   if (!req.params.id)
  //     fail(new Error('Failed to delete comment'));
  //   var comment;
  //   Step(
  //     function () {
  //       memberDb.collections.comment.findOne({ _id:
  //           new ObjectID(req.params.id) }, this);
  //     },
  //     function (err, com) {
  //       if (err) return fail(err);
  //       if (!com) return fail(new Error('Comment not found'));
  //       comment = com;
  //       if (comment.member_id.toString() !== req.user._id.toString())
  //         return fail(new Error('Insufficient privileges'));
  //       memberDb.collections.comment.remove({ _id: comment._id }, this);
  //     },
  //     function (err) {
  //       if (err) return fail(err);
  //       console.log('\nDeleted comment: ' + inspect(comment) + '\n');
  //       memberDb.collections.post.update({ _id: comment.post_id },
  //                                       { $inc: { ccnt: -1 }}, {safe: true },
  //                                       function (err) {
  //         distributeUpdate('comment', 'post', 'ccnt', comment.post_id);
  //       });
  //       res.send({ status: 'success' });
  //       pusher.trigger(channels.all, 'comment.delete', {
  //         id: comment._id.toString()
  //       });
  //     }
  //   );
  //   function fail(err) {
  //     res.send({ status: 'error',
  //              message: err.stack });
  //   }
  // });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
