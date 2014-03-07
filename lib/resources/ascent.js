/*
 * ascent.js: Handling for the ascent resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "name": <String>,
    "type": <String>,
    "grades": [<String>],
    "sector": <String>,
    "crag": <String>,
    "country": <String>,
    "location": {
      "latitude": <Number>,
      "longitude": <Number>
    },
    "crag_id": <ObjectId>,
    "country_id": <ObjectId>,
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
  var search = app.get('reds').createSearch('ascents');

  // Search
  app.post('/api/ascents/search/:s', function (req, res) {
    var crag_id = req.body.crag_id ? db.oid(req.body.crag_id): null;
    var type = req.body.type;

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {

      Step(
        function () {

          // Check results.
          if (ids.length === 0) return this();

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching ascents.
          var query = {_id: {$in: _ids}};
          if (crag_id) query.crag_id = crag_id;
          if (type) query.type = type;
          db.Ascents.list(query, {limit: 50}, this);

        },
        function (err, ascents) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({items: ascents || []}));

        }
      );
      
    }, 'or');

  });

  // Follow
  app.post('/api/ascents/:id/watch', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Find doc.
    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'ascent')) return;

      // Create subscription.
      pubsub.subscribe(req.user, doc, {style: 'watch', type: 'ascent'},
          function (err, sub) {
        if (com.error(err, req, res)) return;

        // Sent status.
        res.send({watched: true});
      });

    });

  });

  // Unwatch
  app.post('/api/ascents/:id/unwatch', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Find doc.
    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'ascent')) return;

      // Remove subscription.
      pubsub.unsubscribe(req.user, doc, function (err) {
        if (com.error(err, req, res)) return;

        // Sent status.
        res.send({unwatched: true});
      });

    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
