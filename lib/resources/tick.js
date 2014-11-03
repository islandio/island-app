/*
 * tick.js: Handling for the tick resource.
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
var Sessions = require('../resources/session');

/* e.g.,
  {
    "_id": <ObjectId>,
    "index": <Number>,
    "type": <String>, (r / b)
    "sent": <Boolean>,
    "grade": <Number>,
    "feel": <Number>,
    "tries": <Number>, (1 - 4)
    "rating": <Number>, (0 - 3)
    "first": <Boolean>,
    "firstf": <Boolean>,
    "date": <ISODate>,
    "note": <String>,
    "author_id": <ObjectId>,
    "country_id": <ObjectId>,
    "crag_id": <ObjectId>,
    "ascent_id": <ObjectId>,
    "session_id": <ObjectId>,
    "action_id": <ObjectId>,
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
  app.post('/api/ticks/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.author_id) query.author_id = db.oid(req.body.author_id);
    if (req.body.parent_id) query.parent_id = db.oid(req.body.parent_id);

    db.Ticks.list(query, {sort: {created: 1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, ticks) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        ticks: {
          cursor: ++cursor,
          more: ticks && ticks.length === limit,
          items: ticks
        }
      }));

    });

  });

  // Create (TODO)
  app.post('/api/ticks', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    var props = req.body;
    props.author_id = req.user._id;

    db.Ticks.create(props, {inflate: {author: profiles.member}},
        function (err, doc) {
      if (com.error(err, req, res)) return;

      res.send({id: doc._id.toString()});
    });

  });

  // Update (TODO)
  app.put('/api/ticks/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/ticks/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the tick.
    db.Ticks.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'tick')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'Member invalid'});

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Remove notifications for events where tick is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
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
          },
          function (err) {
            if (err) return this(err);

            // Remove content on tick.
            db.Comments.remove({parent_id: doc._id}, this.parallel());
            db.Hangtens.remove({parent_id: doc._id}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());

            // Finally, remove the tick.
            db.Ticks.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Get the tick's session's other ticks.
            db.Ticks.list({session_id: doc.session_id}, this);
          },
          function (err, ticks) {
            if (com.error(err, req, res)) return;

            // Remove the session if it's empty.
            if (ticks.length === 0) {
              Sessions.deleteSession(doc.session_id, req.user, this);
            } else {
              this();
            }
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Publish removed status.
            if (event) {
              pubsub.publish('event', 'event.removed', {data: event});
            }
            pubsub.publish('tick', 'tick.removed', {data: {id: doc._id.toString()}});

            res.send({removed: true});
          }
        );
      
      });
    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
