/*
 * ascent.js: Handling for the ascent resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db.js');
var com = require('../common.js');

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
  var search = app.get('reds').createSearch('ascents');

  // Search
  app.post('/api/ascents/search/:s', function (req, res) {

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
          db.Ascents.list({_id: {$in: _ids}}, {limit: 20}, this);

        },
        function (err, ascents) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({items: ascents || []}));

        }
      );
      
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
