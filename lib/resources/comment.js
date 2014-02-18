/*
 * comment.js: Handling for the comment resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
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

  // List
  app.post('/api/comments/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.author_id) query.author_id = db.oid(req.body.author_id);
    if (req.body.parent_id) query.parent_id = db.oid(req.body.parent_id);

    db.Comments.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, comments) {
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

  // Create
  app.post('/api/comments/:container/:type', function (req, res) {
    if (!req.body.body || req.body.body === ''
        || !req.body.parent_id)
      return res.send(403, {error: 'Comment invalid'});

    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    var type = req.params.type;
    var containerType = req.params.container;
    var typeResource = _.capitalize(type) + 's';
    var containerResource = containerType !== 'null' ?
        _.capitalize(containerType) + 's': null;
    var props = req.body;
    props.author_id = req.user._id;

    // Get the comment's parent.
    db[typeResource].read({_id: db.oid(props.parent_id)},
        {inflate: {author: profiles.member}}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // Get parent's container (if there is one).
          if (!parent.parent_id) return this();
          db[containerResource].read({_id: parent.parent_id}, this);
        },
        function (err, container) {
          if (com.error(err, req, res)) return;

          // Create the comment.
          props.parent_id = parent._id;
          db.Comments.create(props, {inflate: {author: profiles.member}},
              function (err, doc) {
            if (com.error(err, req, res)) return;

            // Handle different types.
            var target = {
              t: type,
              i: parent.author._id.toString(),
              a: parent.author.displayName
            };
            switch (type) {
              case 'post':
                target.n = parent.title !== '' ?
                    parent.title: _.prune(parent.body, 20);
                target.s = parent.key;
                break;
              case 'session':
                target.n = parent.name;
                target.s = parent.key;
                break;
              case 'media':
                target.p = parent.type;
                target.c = containerType;
                target.n = container.name;
                target.w = container.crag;
                target.s = ['crags/' + container.key, parent._id.toString()].join('#');
                break;
            }

            // Notify subscribers of event.
            pubsub.notify({actor_id: req.user._id, target_id: parent._id,
                action_id: doc._id, data: {
              action: {
                i: req.user._id.toString(),
                a: req.user.displayName,
                g: req.user.gravatar,
                t: 'comment',
                b: _.prune(doc.body, 40)
              },
              target: target
            }}, doc.body);

            // Subscribe actor to future events.
            pubsub.subscribe(req.user, parent, {style: 'watch', type: type});

            // Publish comment.
            pubsub.publish(type + '-' + parent._id.toString(), 'comment.new', doc);

            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Read
  app.get('/api/comments/:id', function (req, res) {

    // Get the comment.
    db.Comments.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'comment')) return;
      res.send(doc);
    });

  });

  // Update (TODO)
  app.put('/api/comments/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    res.send();

  });

  // Delete
  app.delete('/api/comments/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the comment.
    db.Comments.read({_id: db.oid(req.params.id),
        author_id: req.user._id}, function (err, doc) {
      if (com.error(err, req, res, doc, 'comment')) return;

      Step(
        function () {

          // Remove notifications for events where comment is action.
          db.Events.list({action_id: doc._id}, _.bind(function (err, events) {
            if (events.length === 0) return this();
            var _this = _.after(events.length, this);
            _.each(events, function (e) {

              // Publish removed status.
              pubsub.publish('events', 'event.removed', e);

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {id: note._id.toString()});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        }, function (err) {
          if (err) return this(err);

          // Remove events where comment is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the comment.
          db.Comments.remove({_id: db.oid(req.params.id)}, this.parallel());

        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('post-' + doc.parent_id.toString(),
              'comment.removed', {id: req.params.id});

          res.send({removed: true});
        }
      );

    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
