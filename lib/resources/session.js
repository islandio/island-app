/*
 * session.js: Handling for the session resource.
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
    "env": <Number>, (0 / 1)
    "skin": <Number>, (1 - 5)
    "date": <ISODate>,
    "name": <String>,
    "note": <String>,
    "author_id": <ObjectId>,
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
  app.post('/api/sessions/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = {};

    if (req.body.author_id) query.author_id = db.oid(req.body.author_id);

    db.Sessions.list(query, {sort: {created: 1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, sessions) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({
        sessions: {
          cursor: ++cursor,
          more: sessions && sessions.length === limit,
          items: sessions
        }
      }));

    });

  });

  // Create
  app.post('/api/sessions', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    var props = req.body;
    props.author_id = req.user._id;

    db.Sessions.create(props, {inflate: {author: profiles.member}},
        function (err, doc) {
      if (com.error(err, req, res)) return;

      res.send({id: doc._id.toString()});
    });

  });

  // Read
  app.get('/api/sessions/:id', function (req, res) {

    // Get the session.
    db.Sessions.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'session')) return;
      res.send(doc);
    });

  });

  // Update (TODO)
  app.put('/api/sessions/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    res.send();
  });

  // Delete (TODO)
  app.delete('/api/sessions/:id', function (req, res) {
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
