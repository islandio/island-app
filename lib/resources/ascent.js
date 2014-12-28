/*
 * ascent.js: Handling for the ascent resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var curl = require('curlrequest');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');

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
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var cache = app.get('cache');

  function mapAscentCragCount(ascent, op, cb) {
    var query = "UPDATE " + app.get('CARTODB_CRAGS_TABLE') + " SET "
        + ascent.type + "cnt = " + ascent.type + "cnt " + op
        + " 1 WHERE id = '" + ascent.crag_id.toString() + "'";

    function _post(q, cb) {
      curl.request({
        url: 'https://' + app.get('CARTODB_USER')
            + '.cartodb.com/api/v2/sql',
        method: 'POST',
        data: {q: q, api_key: app.get('CARTODB_API_KEY')}
      }, cb);
    }

    Step(
      function () {
        _post(query, this);
      },
      function (err, data) {
        if (data) {
          data = JSON.parse(data);
          cb(data.error);
        } else {
          cb(err);
        }
      }
    );
  }

  function publishAscent(mem, ascent, cb) {
    Step(
      function () {
        db.inflate(ascent, {author: profiles.member,
            crag: profiles.crag}, this.parallel());
        db.fill(ascent, 'Hangtens', 'parent_id', this.parallel());
      },
      function (err) {
        if (err) return this(err);

        events.publish('ascent', 'ascent.new', {
          data: ascent,
          event: {
            actor_id: mem._id,
            target_id: ascent.crag._id,
            action_id: ascent._id,
            action_type: 'ascent',
            data: {
              action: {
                i: mem._id.toString(),
                a: mem.displayName,
                g: mem.gravatar,
                t: 'ascent',
                b: _.prune(ascent.note || '', 40),
                n: ascent.name,
                c: ascent.country,
                s: ['crags', ascent.key].join('/'),
              }
            }
          },
          public: ascent.public
        });

        // Subscribe actor to future events.
        events.subscribe(mem, ascent, {style: 'watch', type: 'ascent'});
        this();
      }, cb
    );
  }

  // Create one or many ascents
  app.post('/api/ascents', function (req, res) {

    req.body = _.isArray(req.body) ? req.body : [req.body];
    var ascents = [];
    var crags = [];

    var error = null;

    var finish = _.after(req.body.length, function () {
      if (errorHandler(error, req, res)) return;
      var obj = {added: true,
          key: _.pluck(ascents, 'key'),
          crag: _.pluck(crags, 'name'),
          crag_id: _.map(crags, function (c) { return c._id.toString()}),
          ascent_id: _.map(ascents, function (a) { return a._id.toString() })
      };
      // Don't return single value arrays
      _.each(obj, function (v, k) {
        if (_.isArray(v) && v.length == 1) obj[k] = v[0];
      });
      res.send(obj);
    });

    _.each(req.body, function (props) {
      if (!props.crag_id || !props.name || !props.type || !props.grades) {
        error = 'Invalid ascent props';
        return finish();
      }
      props.crag_id = db.oid(props.crag_id);

      // Handle public.
      var pub = props.public !== 'false' && props.public !== false;
      delete props.public;

      Step(
        function () {
          db.Crags.read({_id: props.crag_id}, this);
        },
        function (err, crag) {
          if (err) {
            error = 'Crag not found';
            return finish();
          }

          crags.push(crag);
          var noPublish = props.noPublish;
          delete props.noPublish;

          // Create the new ascent.
          db.Ascents.create(_.extend(props, {
            author_id: noPublish || !req.user ? null : req.user._id,
            crag: crag.name,
            country_id: crag.country_id,
            country: crag.country,
            location: crag.location,
            key: [crag.key, props.type === 'b' ? 'boulders': 'routes',
                _.slugify(props.name)].join('/'),
            public: pub
          }), {force: {key: 1}},
              function (err, ascent) {
            if (err) { error = 'Error adding ascent'; return finish(); };

            Step(
              function () {
                mapAscentCragCount(ascent, '+', this);
              },
              function (err) {
                if (err) { error = err; return finish(); };
                if (!noPublish && req.user) {
                  publishAscent(req.user, ascent, this);
                }
              },
              function (err) {
                if (err) { error = 'Error publishing ascent'; return finish(); };

                // Index.
                cache.index('ascents', ascent, ['name'], {strategy: 'noTokens'});

                ascents.push(ascent);
                return finish();
              }
            );
          });
        }
      );
    });
  });

  // Get
  app.get('/api/ascents/:id', function (req, res) {
    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'ascents')) return;
      res.send(iutil.client(doc));
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
        if (errorHandler(err, req, res)) return;

        // Filter ascents by grade.
        var data = {ascents: {b: {}, r: {}}, bcnt: 0, rcnt: 0};
        _.each(ascents, function (a) {
          _.each(a.grades, function (g) {
            if (data.ascents[a.type][g]) {
              data.ascents[a.type][g].push(a);
            } else {
              data.ascents[a.type][g] = [a];
            }
            ++data[a.type + 'cnt'];
          });
        });

        // Send profile.
        res.send(iutil.client(data));
      }
    );
  });

  // Search
  app.post('/api/ascents/search/:s', function (req, res) {
    var crag_id = req.body.crag_id ? db.oid(req.body.crag_id): null;
    var type = req.body.type;

    // Perform the search.
    // Note: Taking 1000 ascents here - a better way would be to 
    // index the ascent with the crag name as key somehow
    cache.search('ascents', req.params.s, 1000, function (err, ids) {
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
          if (errorHandler(err, req, res)) return;

          // Send profile.
          res.send(iutil.client({items: ascents || []}));
        }
      );
    }, 'or');
  });

  // Watch
  app.post('/api/ascents/:id/watch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Find doc.
    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'ascent')) return;

      // Create subscription.
      events.subscribe(req.user, doc, {style: 'watch', type: 'ascent'},
          function (err, sub) {
        if (errorHandler(err, req, res)) return;

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
      if (errorHandler(err, req, res, doc, 'ascent')) return;

      // Remove subscription.
      events.unsubscribe(req.user, doc, function (err) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({unwatched: true});
      });
    });
  });

  return exports;
}
