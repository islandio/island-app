/*
 * tick.js: Handling for the tick resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');
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
    "updated": <ISODate>,
    "public": <Boolean>,
  }
*/

// Do any initializations
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // List
  app.post('/api/ticks/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.author_id) {
      query.author_id = db.oid(req.body.author_id);
    }
    if (req.body.parent_id) {
      query.parent_id = db.oid(req.body.parent_id);
    }

    db.Ticks.list(query, {sort: {created: 1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, ticks) {
      if (errorHandler(err, req, res)) return;

      // Send profile.
      res.send(iutil.client({
        ticks: {
          cursor: ++cursor,
          more: ticks && ticks.length === limit,
          items: ticks
        }
      }));

    });

  });

  // Delete
  app.delete('/api/ticks/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the tick.
    db.Ticks.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'tick')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: 'Member invalid'});
      }

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (errorHandler(err, req, res)) return;

        Step(
          function () {

            // Remove notifications for events where tick is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, es) {
              if (es.length === 0) {
                return this();
              }
              var _this = _.after(es.length, this);
              _.each(es, function (e) {

                // Publish removed status.
                events.publish('event', 'event.removed', {data: e});

                db.Notifications.list({event_id: e._id}, function (err, notes) {

                  // Publish removed statuses.
                  _.each(notes, function (note) {
                    events.publish('mem-' + note.subscriber_id.toString(),
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
            db.Medias.remove({parent_id: doc._id}, this.parallel());
            db.Comments.remove({parent_id: doc._id}, this.parallel());
            db.Hangtens.remove({parent_id: doc._id}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());

            // Finally, remove the tick.
            db.Ticks.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Get the tick's session's other ticks.
            db.Ticks.list({session_id: doc.session_id}, this);
          },
          function (err, ticks) {
            if (errorHandler(err, req, res)) return;

            // Remove the session if it's empty.
            if (ticks.length === 0) {
              Sessions.deleteSession(doc.session_id, req.user, this);
            } else {
              this();
            }
          },
          function (err) {
            if (errorHandler(err, req, res)) return;

            // Publish removed status.
            if (event) {
              events.publish('event', 'event.removed', {data: event});
            }
            events.publish('tick', 'tick.removed', {data: {id: doc._id.toString()}});

            // Finish.
            res.send({removed: true});
          }
        );
      });
    });
  });

  // Download
  app.get('/api/ticks', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    db.Ticks.list({author_id: req.user._id},
        {inflate: {ascent: profiles.ascent}}, function (err, ticks) {
      if (errorHandler(err, req, res)) return;

      if (req.query && req.query['csv']) {
        // Make a csv
        var csv = '';
        function addLine(strs) { csv += strs.join() + '\r\n' }
        addLine(['Date', 'Name', 'Crag', 'Type', 'Sent', 'Grade', 'Felt',
            'Tries', 'My rating']);
        _.each(ticks, function (t) {
          addLine([
              new Date(t.date).toDateString(),
              t.ascent.name, t.ascent.crag,
              t.type === 'r' ? 'Route' : t.type === 'b' ? 'Boulder' : 'Unknown',
              t.sent === true ? 'Sent' : '',
              t.ascent.grades[0], t.feel, t.tries, t.rating
          ]);
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition',
            'attachment; filename=' + req.user.displayName.trim() + ' - Island Tick List.csv')
        res.send(csv);
      } else {
        res.send(ticks);
      }
    });
  });

  // Watch
  app.post('/api/ticks/:id/watch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Find doc.
    db.Ticks.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'tick')) return;

      // Create subscription.
      events.subscribe(req.user, doc, {style: 'watch', type: 'tick'},
          function (err, sub) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({watched: true});
      });

    });

  });

  // Unwatch
  app.post('/api/ticks/:id/unwatch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Find doc.
    db.Ticks.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'tick')) return;

      // Remove subscription.
      events.unsubscribe(req.user, doc, function (err) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({unwatched: true});
      });

    });

  });

  return exports;
}
