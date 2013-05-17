/*
 * notification.js: Handling for the notification resource.
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
  
  subscription: {
    "_id": <ObjectId>,
    "meta": {
      "style": <String>, (watch || follow)
      "type": <String>, (post, crag, ascent, etc.)
    },
    "mute": <Boolean>,
    "subscriber_id": <ObjectId>,
    "subscribee_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }
  
  event: {
    "_id": <ObjectId>,
    "data": {
      "action": {
        "a": <String>, (actor member displayName)
        "g": <String>, (actor md5 email hash)
        "t": <String>, (action type: comment, tick, star, follow, etc.)
        "b": <String>, (action message)
      },
      "target": {
        "a": <String>, (target member displayName)
        "n": <String>, (target title)
        "t": <String>, (target type: post, crag, ascent, etc.)
        "s": <String>, (slug)
      }
    },
    "actor_id": <ObjectId>,
    "target_id": <ObjectId>,
    "action_id": <ObjectId>,
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

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // list
  app.post('/api/notifications', function (req, res) {
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

  // update as read
  app.put('/api/notifications/read/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    db.Notifications.update({_id: db.oid(req.params.id),
        subscriber_id: req.user._id},
        {$set: {read: true}}, function (err, stat) {
      if (com.error(err, req, res, stat, 'notification')) return;

      // Publish read status.
      pubsub.publish('mem-' + req.user.key,
          'notification.read', {id: req.params.id});

      res.send({updated: true});
    });

  });

  // delete
  app.delete('/api/notifications/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    db.Notifications.delete({_id: db.oid(req.params.id),
        subscriber_id: req.user._id}, function (err, stat) {
      if (com.error(err, req, res, stat, 'notification')) return;

      // Publish removed status.
      pubsub.publish('mem-' + req.user.key,
          'notification.removed', {id: req.params.id});

      res.send({removed: true});
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
