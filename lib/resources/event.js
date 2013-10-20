/*
 * notification.js: Handling for the event resource.
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

*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // List
  app.post('/api/events/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    db.Events.list(query, {sort: {created: -1},
        limit: limit, skip: limit * cursor}, function (err, events) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        events: {
          cursor: ++cursor,
          more: events && events.length === limit,
          items: events
        }
      }));

    });
  });

  // Update
  app.put('/api/events/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/events/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    db.Events.delete({_id: db.oid(req.params.id),
        actor_id: req.user._id}, function (err, stat) {
      if (com.error(err, req, res, stat, 'event')) return;

      // Publish removed status.
      pubsub.publish('mem-' + req.user._id.toString(),
          'event.removed', {id: req.params.id});

      res.send({removed: true});
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
