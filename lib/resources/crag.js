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
  exports.cache = app.get('cache');
  return exports;
}

// Find crags.
exports.find = function (params, cb) {
  var query = {};
  if (params.country)
    query.key = {$regex: params.country + '\/.*', $options: 'i'};
  if (params.query && params.query !== '')
    exports.cache.search('crags', params.query, 20, function (err, ids) {
      ids = _.map(ids, function(i) { return i.split('::')[1]; });
      if (!ids || ids.length === 0) return _finish(null, []);
      query._id = {$in: _.map(ids, function (id) { return db.oid(id); })};
      _list();
    }, 'or');
  else if (query.key) _list();
  else _finish(null, []);

  function _list() {
    db.Crags.list(query, {sort: {key: 1}}, _finish);
  }

  function _finish(err, docs) {
    if (err) return cb(err);
    cb(null, {items: docs, params: params});
  }
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // Get
  app.get('/api/crags/:id', function (req, res) {
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'crag')) return;
      res.send(com.client(doc));
    });
  });

  // Search
  app.post('/api/crags/search/:s', function (req, res) {
    var params = {query: req.params.s};

    // Check for country code filter.
    if (params.query.indexOf(':') === 3) {
      var parts = params.query.split(':');
      params.country = parts[0];
      params.query = parts[1];
    }

    exports.find(params, function (err, data) {
      if (com.error(err, req, res)) return;
      res.send(com.client(data));
    });
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
