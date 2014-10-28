/*
* crag.js: Handling for the crag resource.
 *
 */

// Module Dependencies
var request = require('request');
var curl = require('curlrequest');
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
  if (params.country) {
    query.key = {$regex: params.country + '\/.*', $options: 'i'};
  }
  if (params.query && params.query !== '') {
    exports.cache.search('crags', params.query, 20, function (err, ids) {
      ids = _.map(ids, function(i) { return i.split('::')[1]; });
      if (!ids || ids.length === 0) {
        return _finish(null, []);
      }
      query._id = {$in: _.map(ids, function (id) { return db.oid(id); })};
      _list();
    }, 'or');
  } else if (query.key) {
    _list();
  } else {
    _finish(null, []);
  }

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

  function mapCrag(user, crag, cb) {
    var names = ["the_geom", "id", "name", "bcnt", "rcnt",
        "country_id", "key"].join(",");
    var values = [
        "CDB_LatLng(" + crag.location.latitude + ","
        + crag.location.longitude + ")",
        "'" + crag._id.toString() + "'",
        "'" + crag.name.replace(/'/g, "''") + "'",
        crag.bcnt, crag.rcnt,
        "'" + crag.country_id + "'",
        "'" + crag.key + "'"].join(",");
    var query = "INSERT INTO " + app.get('CARTODB_CRAGS_TABLE') + " ("
        + names + ") VALUES (" + values + ")";

    function _post(q, cb) {

      // Insert new record.
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
          if (data.error && data.error[0].indexOf('_idx') !== -1) {
            return this(null, true);
          }
          this(data.error);
        } else {
          this(err);
        }
      },
      function (err, update) {
        if (err) return this(err);
        if (!update) return this();

        // Insert failed because row exists. Update instead.
        var query = "UPDATE " + app.get('CARTODB_CRAGS_TABLE') + " SET ("
            + names + ") = (" + values + ") WHERE id = '"
            + crag._id.toString() + "'";
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

  function publishCrag(user, crag, cb) {

    // Publish crag.
    pubsub.publish('crag', 'crag.new', {
      data: crag,
      event: {
        actor_id: user._id,
        target_id: null,
        action_id: crag._id,
        action_type: 'crag',
        data: {
          action: {
            i: user._id.toString(),
            a: user.displayName,
            g: user.gravatar,
            t: 'crag',
            b: _.prune(crag.note || '', 40),
            n: crag.name,
            c: crag.country,
            s: ['crags', crag.key].join('/'),
          }
        }
      }
    });

    // Subscribe actor to future events.
    pubsub.subscribe(user, crag, {style: 'watch', type: 'crag'});
    cb();
  }

  // Create
  // TODO:
  //   - create event is first event in crag's feed
  app.post('/api/crags', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    if (!req.body.name || !req.body.location) {
      return res.send(403, {error: 'Crag invalid'});
    }
    var props = req.body;
    var countryInfo;
    var countryKey;

    Step(
      function () {

        // Get the country at this location.
        var codeUrl = 'http://api.geonames.org/countryCodeJSON?formatted=true'
            + '&username=islandio&lat=' + props.location.latitude + '&lng='
            + props.location.longitude;
        request.get({url: codeUrl, json: true}, this);
      },
      function (err, r, code) {
        if (com.error(err, req, res)) return;
        if (com.error(code.status, req, res)) return;
        var infoUrl = 'http://api.geonames.org/countryInfoJSON?formatted=true'
            + '&username=islandio&country=' + code.countryCode;
        request.get({url: infoUrl, json: true}, this);
      },
      function (err, r, data) {
        if (com.error(err, req, res)) return;
        if (com.error(data.status, req, res)) return;
        countryInfo = data.geonames[0] || null;
        if (!countryInfo) {
          if (com.error({message: 'no country code found'}, req, res)) return;
        }
        countryKey = countryInfo.isoAlpha3.toLowerCase();
        db.Countries.read({key: countryKey}, this);
      },
      function (err, country) {
        if (com.error(err, req, res)) return;
        if (!country) {
          db.Countries.create({
            name: countryInfo.countryName,
            key: countryKey
          }, this);
        } else {
          this(null, country);
        }
      },
      function (err, country) {
        if (com.error(err, req, res, country, 'country')) return;

        // Create the new crag.
        db.Crags.create(_.extend(props, {
          author_id: req.user._id,
          country_id: country._id,
          country: country.name,
          key: [country.key, _.slugify(props.name)].join('/'),
          bcnt: 0,
          rcnt: 0
        }), {force: {key: 1}}, function (err, crag) {
          if (com.error(err, req, res)) return;

          Step(
            function () {
              mapCrag(req.user, crag, this);
            },
            function (err) {
              if (com.error(err, req, res)) return;
              publishCrag(req.user, crag, this);
            },
            function (err) {
              if (com.error(err, req, res)) return;
              res.send({added: true, country: crag.country, key: crag.key});
            }
          );
        });
      }
    );
  });

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
