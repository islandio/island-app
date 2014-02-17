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
    "name": <String>,
    "note": <String>,
    "date": <ISODate>,
    "author_id": <ObjectId>,
    "crag_id": <ObjectId>,
    "country_id": <ObjectId>,
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
    if (!req.body.crag_id || !req.body.date)
      return res.send(403, {error: 'Session invalid'});
    var props = req.body;

    // Get the crag.
    db.Crags.findOne({_id: db.oid(props.crag_id)}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

      // Setup the session.
      props.key = com.createId_32();
      props.author_id = req.user._id;
      props.country_id = crag.country_id;
      props.crag_id = crag._id;
      props.date = new Date(Number(props.date));
      props.env = 0; // 0 = outside. TODO: handle indoor.
      if (props.name === '') delete props.name;
      if (props.note === '') delete props.note;

      // Remove actions from props.
      var actions = props.actions;
      delete props.actions;

      // Create the session.
      db.Sessions.create(props, {force: {key: 1}}, function (err, doc) {
        if (com.error(err, req, res)) return;

        Step(
          function () {
            if (!actions || actions.length === 0) return this();
            var next = _.after(actions.length, this);
            _.each(actions, function (action) {

              // Remove ticks from action.
              var ticks = action.ticks;
              delete action.ticks;

              // Create action.
              action.session_id = doc._id;
              action.author_id = doc.author_id;
              action.country_id = doc.country_id;
              action.crag_id = doc.crag_id;
              action.date = doc.date;
              action.env = doc.env;
              action.type = Number(action.type);
              action.duration = Number(action.duration);
              if (isNaN(action.duration)) delete action.duration;
              action.performance = Number(action.performance);
              if (isNaN(action.performance)) delete action.performance;
              db.Actions.create(action, function (err, a) {
                if (com.error(err, req, res)) return;

                if (!ticks || ticks.length === 0) return next();
                var _next = _.after(ticks.length, next);
                _.each(ticks, function (tick) {

                  // Get the ascent.
                  db.Ascents.findOne({_id: db.oid(tick.ascent_id)},
                      function (err, ascent) {
                    if (com.error(err, req, res, ascent, 'ascent')) return;

                    // Create tick.
                    tick.session_id = doc._id;
                    tick.author_id = doc.author_id;
                    tick.country_id = doc.country_id;
                    tick.crag_id = doc.crag_id;
                    tick.date = doc.date;
                    tick.env = doc.env;
                    tick.action_id = a._id;
                    tick.ascent_id = ascent._id;
                    tick.type = String(tick.type);
                    tick.sent = tick.sent ? true: false;
                    tick.grade = Number(tick.grade);
                    if (isNaN(tick.grade)) delete tick.grade;
                    tick.feel = Number(tick.feel);
                    if (isNaN(tick.feel)) delete tick.feel;
                    tick.tries = Number(tick.tries);
                    if (isNaN(tick.tries)) delete tick.tries;
                    tick.rating = Number(tick.rating);
                    if (isNaN(tick.rating)) delete tick.rating;
                    var first = Number(tick.first);
                    if (!isNaN(first)) {
                      tick.first = false;
                      tick.firstf = false;
                      switch (first) {
                        case 0: default: break;
                        case 1: tick.first = true; break;
                        case 2: tick.firstf = true; break;
                      }
                    } else delete tick.first;
                    if (tick.note === '') delete tick.note;
                    db.Ticks.create(tick, _next);
                  });

                });
              });
            });
          },
          function (err) {
            if (com.error(err, req, res)) return;


            // Handle events.

            res.send({id: doc._id.toString()});
          }
        );

      });
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
