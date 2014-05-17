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

  // Create
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

  // Delete (TODO)
  app.delete('/api/ticks/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    res.send();
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}