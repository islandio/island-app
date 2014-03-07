/*
* crag.js: Handling for the crag resource.
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
    "city": <String>,
    "country": <String>,
    "bcnt": <Number>,
    "rcnt": <Number>,
    "bgrdu": <String>,
    "bgrdl": <String>,
    "rgrdu": <String>,
    "rgrdl": <String>,
    "location": {
      "latitude": <Number>,
      "longitude": <Number>
    },
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
  var search = app.get('reds').createSearch('crags');

  // Search
  app.post('/api/crags/search/:s', function (req, res) {

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

          // Get the matching crags.
          db.Crags.list({_id: {$in: _ids}}, {limit: 50}, this);

        },
        function (err, crags) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({items: crags || []}));

        }
      );
      
    }, 'or');

  });

  // Follow
  app.post('/api/crags/:id/watch', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Find doc.
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'crag')) return;

      // Create subscription.
      pubsub.subscribe(req.user, doc, {style: 'watch', type: 'crag'},
          function (err, sub) {
        if (com.error(err, req, res)) return;

        // Sent status.
        res.send({watched: true});
      });

    });

  });

  // Unwatch
  app.post('/api/crags/:id/unwatch', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Find doc.
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'crag')) return;

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
