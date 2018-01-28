/*
 * notification.js: Handling for the notification resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('@islandio/util');
var Step = require('step');
var _ = require('underscore');
var authorize = require('./member').authorize;
var profiles = require('@islandio/collections').profiles;
var app = require('../../app');

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
exports.init = function () {
  return this.routes();
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // List
  app.post('/api/notifications/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.subscriber_id) {
      query.subscriber_id = db.oid(req.body.subscriber_id);
    }

    db.Notifications.list(query, {sort: {created: -1},
        limit: limit, skip: limit * cursor,
        inflate: {event: profiles.event}}, function (err, notes) {
      if (errorHandler(err, req, res)) return;

      res.send(iutil.client({
        notes: {
          cursor: ++cursor,
          more: notes && notes.length === limit,
          items: notes
        }
      }));
    });
  });

  // List
  app.post('/api/subscriptions/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var skip = req.body.skip || limit * cursor;
    var query = req.body.query || {};
    var inflate = {};

    if (typeof query.subscribee_id === 'string') {
      query.subscribee_id = db.oid(query.subscribee_id);
      inflate.subscriber = profiles.member;
    }
    if (typeof query.subscriber_id === 'string') {
      query.subscriber_id = db.oid(query.subscriber_id);
      inflate.subscribee = profiles.member;
    }

    db.Subscriptions.list(query, {sort: {created: -1},
        limit: limit, skip: skip, inflate: inflate}, function (err, subs) {
      if (errorHandler(err, req, res)) return;

      res.send(iutil.client({
        subscriptions: {
          cursor: ++cursor,
          more: subs.length !== 0,
          items: subs
        }
      }));
    });
  });

  // Update as read
  app.put('/api/notifications/read/:id', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    db.Notifications.update({_id: db.oid(req.params.id),
        subscriber_id: req.user._id},
        {$set: {read: true}}, function (err, stat) {
      if (errorHandler(err, req, res, stat, 'notification')) return;

      // Publish read status.
      events.publish('mem-' + req.user._id.toString(),
          'notification.read', {data: {id: req.params.id}});

      res.send({updated: true});
    });

  });

  // Delete
  app.delete('/api/notifications/:id', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    db.Notifications.remove({_id: db.oid(req.params.id)}, function (err, stat) {
      if (errorHandler(err, req, res, stat, 'notification')) return;

      // Publish removed status.
      events.publish('mem-' + req.user._id.toString(),
          'notification.removed', {data: {id: req.params.id}});

      res.send({removed: true});
    });

  });

  return exports;
};
