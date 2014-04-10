/*
 * hangten.js: Handling for the hangten resource.
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

  // Create
  app.post('/api/hangtens/:type', function (req, res) {
    if (!req.body.parent_id)
      return res.send(403, {error: 'Hangten invalid'});

    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = {author_id: req.user._id};

    // Get the hangten's parent.
    db[typeResource].read({_id: db.oid(req.body.parent_id)},
        {inflate: {author: profiles.member}}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // Create the hangten.
          props.parent_id = parent._id;
          db.Hangtens.create(props, {inflate: {author: profiles.member}},
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
            }

            // Publish hangten.
            pubsub.publish('hangten', 'hangten.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: parent._id,
                action_id: doc._id,
                action_type: 'hangten',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'hangten',
                    b: _.prune(doc.body, 40)
                  },
                  target: target
                }
              },
              notify: [parent.author._id]
            });

            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Delete
  app.delete('/api/hangtens/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the hangten.
    db.Hangtens.read({_id: db.oid(req.params.id),
        author_id: req.user._id}, function (err, doc) {
      if (com.error(err, req, res, doc, 'hangten')) return;

      Step(
        function () {

          // Remove notifications for events where hangten is action.
          db.Events.list({action_id: doc._id}, _.bind(function (err, events) {
            if (events.length === 0) return this();
            var _this = _.after(events.length, this);
            _.each(events, function (e) {

              // Publish removed status.
              pubsub.publish('event', 'event.removed', {data: e});

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {data: {id: note._id.toString()}});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        }, function (err) {
          if (err) return this(err);

          // Remove events where hangten is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the hangten.
          db.Hangtens.remove({_id: db.oid(req.params.id)}, this.parallel());

        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('hangten', 'hangten.removed', {data: {id: req.params.id}});

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
