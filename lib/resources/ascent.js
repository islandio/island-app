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
    "rock": <String>,
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
  var cache = app.get('cache');

  function publishAscent(user, ascent, cb) {

    // Publish ascent.
    pubsub.publish('ascent', 'ascent.new', {
      data: ascent,
      event: {
        actor_id: user._id,
        target_id: null,
        action_id: ascent._id,
        action_type: 'ascent',
        data: {
          action: {
            i: user._id.toString(),
            a: user.displayName,
            g: user.gravatar,
            t: 'ascent',
            b: _.prune(ascent.note || '', 40),
            n: ascent.name,
            c: ascent.country,
            s: ['crags', ascent.key].join('/'),
          }
        }
      }
    });

    // Subscribe actor to future events.
    pubsub.subscribe(user, ascent, {style: 'watch', type: 'ascent'});
    cb();
  }

  // Create
  app.post('/api/ascents', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    if (!req.body.crag_id || !req.body.name) {
      return res.send(403, {error: 'Ascent invalid'});
    }
    var props = req.body;
    props.crag_id = db.oid(props.crag_id);

    Step(
      function () {
        db.Crags.read({_id: props.crag_id}, this);
      },
      function (err, crag) {
        if (com.error(err, req, res, crag, 'crag')) return;

        // Create the new ascent.
        db.Ascents.create(_.extend(props, {
          author_id: req.user._id,
          crag: crag.name,
          country_id: crag.country_id,
          country: crag.country,
          location: crag.location,
          key: [crag.key, props.type === 'b' ? 'boulders': 'routes',
              _.slugify(props.name)].join('/'),
        }), {force: {key: 1}}, function (err, ascent) {
          if (com.error(err, req, res)) return;

          Step(
            function () {
              publishAscent(req.user, ascent, this);
            },
            function (err) {
              if (com.error(err, req, res)) return;
              res.send({added: true, crag: crag.name, key: ascent.key});
            }
          );
        });
      }
    );
  });

  // Get
  app.get('/api/ascents/:id', function (req, res) {
    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'ascents')) return;
      res.send(com.client(doc));
    });
  });

  // List by crag
  app.post('/api/ascents/list/:cid', function (req, res) {
    var crag_id = db.oid(req.params.cid);

    Step(
      function () {

        db.Ascents.list({crag_id: crag_id}, {sort: {name: 1}}, this);
      },
      function (err, ascents) {
        if (com.error(err, req, res)) return;

        // Filter ascents by grade.
        var data = {ascents: {}, bcnt: 0, rcnt: 0};
        _.each(ascents, function (a) {
          _.each(a.grades, function (g) {
            if (!data.ascents[a.type]) {
              data.ascents[a.type] = {};
            }
            if (data.ascents[a.type][g]) {
              data.ascents[a.type][g].push(a);
            } else {
              data.ascents[a.type][g] = [a];
            }
            ++data[a.type + 'cnt'];
          });
        });

        // Send profile.
        res.send(com.client(data));
      }
    );

  });  

  // Search
  app.post('/api/ascents/search/:s', function (req, res) {
    var crag_id = req.body.crag_id ? db.oid(req.body.crag_id): null;
    var type = req.body.type;

    // Perform the search.
    cache.search('ascents', req.params.s, 20, function (err, ids) {

      Step(
        function () {

          ids = _.map(ids, function(i) { return i.split('::')[1]; });

          // Check results.
          if (!ids || ids.length === 0) return this();

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching ascents.
          var query = {_id: {$in: _ids}};
          if (crag_id) {
            query.crag_id = crag_id;
          }
          if (type) {
            query.type = type;
          }
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
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

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
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

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
