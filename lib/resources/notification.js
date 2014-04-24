/*
 * notification.js: Handling for the notification resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var authorize = require('./member').authorize;
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  
  subscription: {
    "_id": <ObjectId>,
    "meta": {
      "style": <String>, (watch || follow)
      "type": <String>, (post, crag, ascent, user, etc.)
    },
    "mute": <Boolean>,
    "subscriber_id": <ObjectId>,
    "subscribee_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }
  
  notification: {
    "_id": <ObjectId>,
    "read": <Boolean>,
    "subscriber_id": <ObjectId>,
    "subscription_id": <ObjectId>,
    "event_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
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
  app.post('/api/notifications/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.subscriber_id) query.subscriber_id =
        db.oid(req.body.subscriber_id);

    db.Notifications.list(query, {sort: {created: -1},
        limit: limit, skip: limit * cursor,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        posts: {
          cursor: ++cursor,
          more: notes && notes.length === limit,
          items: notes
        }
      }));

    });
  });

  // Update as read
  app.put('/api/notifications/read/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    db.Notifications.update({_id: db.oid(req.params.id),
        subscriber_id: req.user._id},
        {$set: {read: true}}, function (err, stat) {
      if (com.error(err, req, res, stat, 'notification')) return;

      // Publish read status.
      pubsub.publish('mem-' + req.user._id.toString(),
          'notification.read', {data: {id: req.params.id}});

      res.send({updated: true});
    });

  });

  // Delete
  app.delete('/api/notifications/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    db.Notifications.remove({_id: db.oid(req.params.id)}, function (err, stat) {
      if (com.error(err, req, res, stat, 'notification')) return;

      // Publish removed status.
      pubsub.publish('mem-' + req.user._id.toString(),
          'notification.removed', {data: {id: req.params.id}});

      res.send({removed: true});
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
