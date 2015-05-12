/*
* crag.js: Handling for the crag resource.
 *
 */

// Module Dependencies
var request = require('request');
var curl = require('curlrequest');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');
var Ascents = require('../resources/ascent');

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "name": <String>,
    "overview": <String>,
    "city": <String>,
    "country": <String>,
    "bcnt": <Number>,
    "rcnt": <Number>,
    "verified": <Boolean>,
    "tags": <String>,
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
exports.init = function () {
  return this.routes();
};

// Find crags.
exports.find = function (params, cb) {
  var db = app.get('db');
  var cache = app.get('cache');

  var query = {};
  if (params.country) {
    query.key = {$regex: params.country + '\/.*', $options: 'i'};
  }
  if (params.query && params.query !== '') {
    cache.search('crags', params.query, 20, function (err, ids) {
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
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var cache = app.get('cache');

  function deleteCragAscents(id, member, cb) {
    db.Ascents.list({crag_id: id}, function (err, ascents) {
      if (err) return cb(err);
      if (ascents.length === 0) {
        return cb();
      }
      Step(
        function () {
          _.each(ascents, _.bind(function (a) {
            Ascents.deleteAscent(a._id, member, this.parallel());
          }, this));
        }, cb
      );
    });
  }

  function mapRequest(sql, cb) {
    curl.request({
      url: 'https://' + app.get('CARTODB_USER') + '.cartodb.com/api/v2/sql',
      method: 'POST',
      data: {q: sql, api_key: app.get('CARTODB_API_KEY')}
    }, cb);
  }

  function mapCrag(crag, cb) {
    var names = [
      "the_geom",
      "id",
      "name",
      "overview",
      "tags",
      "city",
      "bcnt",
      "rcnt",
      "bgrdl",
      "bgrdu",
      "rgrdl",
      "rgrdu",
      "country_id",
      "key",
      "author_id",
      "forbidden",
      "verified"
    ].join(",");

    var the_geom = crag.location && crag.location.latitude &&
        crag.location.longitude ?
        "CDB_LatLng(" + crag.location.latitude + "," +
        crag.location.longitude + ")": "NULL";
    var author_id = crag.author ? crag.author._id: crag.author_id;

    var values = [
      the_geom,
      "'" + crag._id.toString() + "'",
      "'" + crag.name.replace(/'/g, "''") + "'",
      (crag.overview ? "'" + crag.overview.replace(/'/g, "''") + "'": "NULL"),
      (crag.tags ? "'" + crag.tags.replace(/'/g, "''") + "'": "NULL"),
      (crag.city ? "'" + crag.city.replace(/'/g, "''") + "'": "NULL"),
      crag.bcnt,
      crag.rcnt,
      "'" + (crag.bgrdu || '') + "'",
      "'" + (crag.bgrdl || '') + "'",
      "'" + (crag.rgrdu || '') + "'",
      "'" + (crag.rgrdl || '') + "'",
      "'" + crag.country_id + "'",
      "'" + crag.key + "'",
      (author_id ? "'" + author_id + "'": "NULL"),
      (crag.forbidden ? "TRUE": "FALSE"),
      (crag.verified ? "TRUE": "FALSE")
    ].join(",");

    var query = "INSERT INTO " + app.get('CARTODB_CRAGS_TABLE') + " (" +
        names + ") VALUES (" + values + ")";

    Step(
      function () {
        mapRequest(query, this);
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
        if (!update) {
          return this();
        }

        // Insert failed because row exists. Update instead.
        var query = "UPDATE " + app.get('CARTODB_CRAGS_TABLE') + " SET (" +
            names + ") = (" + values + ") WHERE id = '" +
            crag._id.toString() + "'";
        mapRequest(query, this);
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

  function unMapCrag(id, cb) {
    mapRequest("DELETE FROM " + app.get('CARTODB_CRAGS_TABLE') + " WHERE " +
         "id = '" + id.toString() + "'", cb);
  }

  function publishCrag(mem, crag, cb) {
    Step(
      function () {
        db.inflate(crag, {author: profiles.member}, this.parallel());
        db.fill(crag, 'Hangtens', 'parent_id', this.parallel());
      },
      function (err) {
        if (err) return this(err);

        events.publish('crag', 'crag.new', {
          data: crag,
          event: {
            actor_id: mem._id,
            target_id: null,
            action_id: crag._id,
            action_type: 'crag',
            data: {
              action: {
                i: mem._id.toString(),
                a: mem.displayName,
                g: mem.gravatar,
                v: mem.avatar,
                t: 'crag',
                b: _.prune(crag.note || '', 40),
                n: crag.name,
                c: crag.country,
                s: ['crags', crag.key].join('/'),
              }
            }
          },
          public: crag.public
        });

        // Subscribe actor to future events.
        events.subscribe(mem, crag, {style: 'watch', type: 'crag'});
        this();
      }, cb
    );
  }

  function indexCrag(c) {
    cache.index('crags', c, ['name']);
    cache.index('crags', c, ['name'], {strategy: 'noTokens'});
  }

  function getCountryAtLocation(location, cb) {
    Step(
      function () {
        var codeUrl = 'http://api.geonames.org/countryCodeJSON?formatted=true' +
            '&username=islandio&lat=' + location.latitude + '&lng=' +
            location.longitude;
        request.get({url: codeUrl, json: true}, this);
      },
      function (err, r, code) {
        if (err) return this(err);
        if (code.status) return this(code.status);
        var infoUrl = 'http://api.geonames.org/countryInfoJSON?formatted=true' +
            '&username=islandio&country=' + code.countryCode;
        request.get({url: infoUrl, json: true}, this);
      },
      function (err, r, data) {
        if (err) return this(err);
        if (data.status) return this(data.status);
        countryInfo = data.geonames[0] || null;
        if (!countryInfo) {
          return this({message: 'no country code found'});
        }
        countryKey = countryInfo.isoAlpha3.toLowerCase();
        db.Countries.read({key: countryKey}, this);
      },
      function (err, country) {
        if (err) return cb(err);
        if (!country) {
          db.Countries.create({
            name: countryInfo.countryName,
            key: countryKey
          }, cb);
        } else {
          cb(null, country);
        }
      }
    );
  }

  function getCityAtLocation(location, cb) {
    Step(
      function () {
        var codeUrl = 'http://api.geonames.org/findNearbyPlaceNameJSON?' +
            '&username=islandio&lat=' + location.latitude + '&lng=' +
            location.longitude + '&formatted=true&cities=cities1000';
        request.get({url: codeUrl, json: true}, this);
      },
      function (err, r, data) {
        if (err) return cb(err);
        if (data.status) return cb(data.status);
        cb(null, data.name);
      }
    );
  }

  // Create
  app.post('/api/crags', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
    if (!req.body.name || !req.body.location) {
      return res.send(403, {error: {message: 'Crag invalid'}});
    }
    var props = req.body;
    var countryInfo;
    var countryKey;

    var pub = props.public !== 'false' && props.public !== false;
    delete props.public;

    Step(
      function () {
        getCountryAtLocation(props.location, this);
      },
      function (err, country) {
        if (errorHandler(err, req, res, country, 'country')) return;

        db.Crags.create(_.extend(props, {
          author_id: req.user._id,
          country_id: country._id,
          country: country.name,
          key: [country.key, _.slugify(props.name)].join('/'),
          bcnt: 0,
          rcnt: 0,
          verified: false,
          public: pub
        }), {force: {key: 1}}, function (err, crag) {
          if (errorHandler(err, req, res)) return;

          Step(
            function () {
              mapCrag(crag, this);
            },
            function (err) {
              if (errorHandler(err, req, res)) return;
              publishCrag(req.user, crag, this);
            },
            function (err) {
              if (errorHandler(err, req, res)) return;

              indexCrag(crag);

              res.send({added: true, country: crag.country, key: crag.key,
                  _id: crag._id.toString()});
            }
          );
        });
      }
    );
  });

  // Get
  app.get('/api/crags/:id', function (req, res) {
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'crag')) return;
      res.send(iutil.client(doc));
    });
  });

  // Update
  app.put('/api/crags/:country/:name', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    var key = [req.params.country, req.params.name].join('/');
    var props = req.body;
    var unset = {};

    // Ensure name is descriptive.
    if (props.name !== undefined && props.name.length < 3) {
      return res.send(403, {error: {type: 'LENGTH_INVALID', message:
          'Crag name must be at least 3 characters'}});
    }

    // Possible unsets.
    if (props.overview && props.overview === '') {
      unset.overview = 1;
      delete props.overview;
    }
    if (props.tags && props.tags === '') {
      unset.tags = 1;
      delete props.tags;
    }

    // Check for location update.
    if (props['location.latitude'] !== undefined) {
      if (props['location.latitude'] === '') {
        return res.send(403, {error: {type: 'LENGTH_INVALID', message:
          'Crag locations cannot be removed'}});
      }
      props['location.latitude'] = Number(props['location.latitude']);
    }
    if (props['location.longitude'] !== undefined) {
      if (props['location.longitude'] === '') {
        return res.send(403, {error: {type: 'LENGTH_INVALID', message:
          'Crag locations cannot be removed'}});
      }
      props['location.longitude'] = Number(props['location.longitude']);
    }

    var location = {};
    if (props['location.latitude'] && props['location.longitude']) {
      location.latitude = props['location.latitude'];
      location.longitude = props['location.longitude'];
    }

    // Skip if nothing to do.
    if (_.isEmpty(props) && _.isEmpty(unset)) {
      return res.send(403, {error: {message: 'Crag empty'}});
    }

    db.Crags.read({key: key}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;
      if ((!crag.author_id || req.user._id.toString() !==
          crag.author_id.toString()) && !req.user.admin) {
        return res.send(403, {error: {message: 'Member invalid'}});
      }

      Step(
        function () {

          // Check country only if we have lat and lng.
          if (_.isEmpty(location)) {
            return this();
          }
          getCountryAtLocation(location, this.parallel());
          getCityAtLocation(location, this.parallel());
        },
        function (err, country, city) {
          if (_.isEmpty(location)) {
            if (errorHandler(err, req, res)) return;
          } else {
            if (errorHandler(err, req, res, country, 'country')) return;
          }
          if (city) {
            props.city = city;
          }
          if (country) {
            props.country = country.name;
            props.country_id = country._id;
            props.key = [country.key, req.params.name].join('/');
          }

          var update = {};
          if (!_.isEmpty(props)) {
            update.$set = props;
          }
          if (!_.isEmpty(unset)) {
            update.$unset = unset;
          }

          db.Crags.update({key: key}, update, function (err, stat) {
            if (errorHandler(err, req, res, stat, 'crag')) return;

            Step(
              function () {

                // Update ascent country info.
                db.Ascents.list({crag_id: crag._id},
                    _.bind(function (err, ascents) {
                  if (err) return this(err);
                  if (ascents.length === 0) {
                    return this();
                  }
                  var _this = _.after(ascents.length, this);
                  _.each(ascents, function (a) {
                    var u = {};
                    if (props.name) {
                      u.crag = props.name;
                    }
                    if (props['location.latitude']) {
                      u['location.latitude'] = props['location.latitude'];
                    }
                    if (props['location.longitude']) {
                      u['location.longitude'] = props['location.longitude'];
                    }
                    if (country && country._id.toString() !==
                        a.country_id.toString()) {
                      _.extend(u, {
                        country: country.name,
                        country_id: country._id,
                        key: a.key.replace(key, props.key || key)
                      });
                    }
                    if (!_.isEmpty(u)) {
                      db.Ascents.update({_id: a._id}, {$set: u}, _this);
                    } else {
                      _this();
                    }
                  });
                }, this));
              },
              function (err) {
                if (errorHandler(err, req, res)) return;
                db.Crags.read({_id: crag._id}, this);
              },
              function (err, crag) {
                if (errorHandler(err, req, res, crag, 'crag')) return;

                // Update map.
                mapCrag(crag, function (err) {
                  if (errorHandler(err, req, res)) return;

                  // Index.
                  if (crag) {
                    indexCrag(crag);
                  }

                  res.send({updated: true, key: crag.key});
                });
              }
            );

          });
        }
      );
    });
  });

  // Delete
  app.delete('/api/crags/:country/:name', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
    var cid;
    var mid = req.user._id;
    var key = [req.params.country, req.params.name].join('/');

    function _deleteResource(type, cb) {
      db[_.capitalize(type) + 's'].list({$or: [{crag_id: cid},
          {parent_id: cid}]}, function (err, docs) {
        if (err) return cb(err);
        if (docs.length === 0) {
          return cb();
        }

        Step(
          function () {
            // Handle each doc.
            _.each(docs, _.bind(function (d) {

              // Handle events and notifications.
              (function (cb) {
                Step(
                  function () {
                    // Get all related events.
                    db.Events.list({$or: [{target_id: d._id},
                        {action_id: d._id}]}, this);
                  },
                  function (err, es) {
                    if (err) return this(err);
                    if (es.length === 0) {
                      return this();
                    }
                    var _this = _.after(es.length, this);
                    _.each(es, function (e) {

                      // Publish removed status.
                      events.publish('event', 'event.removed', {data: e});

                      // Get any related notifications.
                      db.Notifications.list({event_id: e._id},
                          function (err, notes) {
                        if (err) return _this(err);

                        // Publish removed statuses.
                        _.each(notes, function (note) {
                          events.publish('mem-' + note.subscriber_id.toString(),
                              'notification.removed', {data: {
                              id: note._id.toString()}});
                        });

                        // Bulk remove notifications.
                        db.Notifications.remove({event_id: e._id}, _this);
                      });
                    });
                  },
                  function (err) {
                    if (err) return this(err);

                    // Bulk remove all related events.
                    db.Events.remove({$or: [{target_id: d._id},
                        {action_id: d._id}]}, this);
                  }, cb
                );
              })(this.parallel());

              // Handle descendants.
              db.Hangtens.remove({parent_id: d._id}, this.parallel());
              db.Comments.remove({parent_id: d._id}, this.parallel());
              db.Medias.remove({parent_id: d._id}, this.parallel());
              db.Subscriptions.remove({subscribee_id: d._id}, this.parallel());

              // Publish doc removed status.
              events.publish(type, type + '.removed', {data: {
                  id: d._id.toString()}});
            }, this));
          },
          function (err) {
            if (err) return this(err);

            // Bulk remove all docs.
            db[_.capitalize(type) + 's'].remove({$or: [{crag_id: cid},
                {parent_id: cid}]}, this);
          }, cb
        );
      });
    }

    // Get the crag
    db.Crags.read({key: key}, function (err, doc) {
      if (errorHandler(err, req, res)) return;
      if ((!doc.author_id || mid.toString() !== doc.author_id.toString()) &&
          !req.user.admin) {
        return res.send(403, {error: {message: 'Member invalid'}});
      }

      cid = doc._id;
      Step(
        function () {
          var parallel = this.parallel;

          // Get events where crag is action (from creation).
          db.Events.list({action_id: cid}, parallel());

          // Delete feed resources.
          _deleteResource('post', parallel());
          _deleteResource('session', parallel());
          _deleteResource('tick', parallel());
          
          // Delete feed resources that have their own feeds.
          deleteCragAscents(cid, req.user, parallel());

          // Delete other resources.
          db.Actions.remove({crag_id: cid}, parallel());
          db.Hangtens.remove({crag_id: cid}, parallel());
          db.Comments.remove({crag_id: cid}, parallel());
          db.Subscriptions.remove({crag_id: cid}, parallel());
        },
        function (err, es) {
          if (err) return this(err);
          if (es.length === 0) {
            return this();
          }

          // Handle remaining notifications created by crag.
          var _this = _.after(es.length, this);
          _.each(es, function (e) {
            db.Notifications.list({event_id: e._id}, function (err, notes) {
              if (err) return _this(err);

              // Publish removed statuses.
              _.each(notes, function (note) {
                events.publish('mem-' + note.subscriber_id.toString(),
                    'notification.removed', {data: {id: note._id.toString()}});
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          });
        },
        function (err) {
          if (err) return this(err);

          // Handle remaining events created by crag.
          db.Events.remove({action_id: cid}, this.parallel());

          // Finally, remove the crag.
          db.Crags.remove({_id: cid}, this.parallel());
          unMapCrag(cid, this.parallel());
        },
        function (err) {
          if (errorHandler(err, req, res)) return;

          // Publish crag removed status.
          events.publish('crag', 'crag.removed', {data: {
              id: cid.toString()}});

          // Done.
          res.send({removed: true});
        }
      );
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
      if (errorHandler(err, req, res)) return;
      res.send(iutil.client(data));
    });
  });

  // Watch
  app.post('/api/crags/:id/watch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find doc.
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'crag')) return;

      // Create subscription.
      events.subscribe(req.user, doc, {style: 'watch', type: 'crag'},
          function (err, sub) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({watched: true});
      });
    });
  });

  // Unwatch
  app.post('/api/crags/:id/unwatch', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find doc.
    db.Crags.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'crag')) return;

      // Remove subscription.
      events.unsubscribe(req.user, doc, function (err) {
        if (errorHandler(err, req, res)) return;

        // Sent status.
        res.send({unwatched: true});
      });
    });
  });

  return exports;
};
