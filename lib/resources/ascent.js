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
    "note": <String>,
    "tags": <String>,
    "type": <String>,
    "grades": [<String>],
    "sector": <String>,
    "rock": <String>,
    "crag": <String>,
    "country": <String>,
    "location": { // not used
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
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var cache = app.get('cache');

  function indexAscent(ascent) {
    cache.index('ascents', ascent, ['name'], {strategy: 'noTokens'});
  }

  function mapAscentCragCount(ascent, op, cb) {
    var query = "UPDATE " + app.get('CARTODB_CRAGS_TABLE') + " SET " +
        ascent.type + "cnt = " + ascent.type + "cnt " + op +
        " 1 WHERE id = '" + ascent.crag_id.toString() + "'";

    function _post(q, cb) {
      curl.request({
        url: 'https://' + app.get('CARTODB_USER') +
            '.cartodb.com/api/v2/sql',
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
                v: mem.avatar,
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

  var deleteAscent = exports.deleteAscent = function (id, member, cb) {
    if (!member) {
      return cb({code: 403, error: {message: 'Member invalid'}});
    }
    if (_.isString(id)) {
      id = db.oid(id);
    }

    function _deleteResource(type, cb) {
      db[_.capitalize(type) + 's'].list({$or: [{ascent_id: id},
          {parent_id: id}]}, function (err, docs) {
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
            db[_.capitalize(type) + 's'].remove({$or: [{ascent_id: id},
                {parent_id: id}]}, this);
          }, cb
        );
      });
    }

    // Get the ascent.
    db.Ascents.read({_id: id}, function (err, doc) {
      if (err) return cb(err);
      if (!doc) {
        return cb({error: {code: 404, message: 'Ascent not found'}});
      }
      if (member._id.toString() !== doc.author_id.toString() && !member.admin) {
        return cb({error: {code: 403, message: 'Member invalid'}});
      }

      Step(
        function () {
          var parallel = this.parallel;

          // Get events where ascent is action (from creation).
          db.Events.list({action_id: id}, parallel());

          // Delete feed resources.
          _deleteResource('post', parallel());
          _deleteResource('tick', parallel());

          // Delete other resources.
          db.Hangtens.remove({crag_id: id}, parallel());
          db.Comments.remove({crag_id: id}, parallel());
          db.Subscriptions.remove({crag_id: id}, parallel());
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

          // Handle remaining events created by ascent.
          db.Events.remove({action_id: id}, this.parallel());

          // Finally, remove the ascent.
          db.Ascents.remove({_id: id}, this.parallel());
        },
        function (err) {
          if (err) return cb(err);

          // Publish ascent removed status.
          events.publish('ascent', 'ascent.removed', {data: {
              id: id.toString()}});

          cb();
        }
      );
    });
  };

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
          crag_id: _.map(crags, function (c) { return c._id.toString(); }),
          ascent_id: _.map(ascents, function (a) { return a._id.toString(); })
      };
      // Don't return single value arrays
      _.each(obj, function (v, k) {
        if (_.isArray(v) && v.length == 1) obj[k] = v[0];
      });
      res.send(obj);
    });

    _.each(req.body, function (props) {
      if (!props.crag_id || props.name === undefined || !props.type ||
          !props.grades) {
        error = {code: 403, message: 'Invalid ascent props'};
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
            error = {code: 404, message: 'Crag not found'};
            return finish();
          }

          crags.push(crag);
          var silent = props.silent;
          delete props.silent;

          props = _.extend(props, {
            author_id: silent || !req.user ? null : req.user._id,
            crag: crag.name,
            country_id: crag.country_id,
            country: crag.country,
            key: [crag.key, props.type === 'b' ? 'boulders': 'routes',
                _.slugify(props.name)].join('/'),
            public: pub
          });
          if (crag.location) {
            props.location = crag.location;
          }

          db.Ascents.create(props, {force: {key: 1}}, function (err, ascent) {
            if (err) {
              error = {message: 'Error adding ascent'};
              return finish();
            }

            mapAscentCragCount(ascent, '+', function (err) {});

            var next = function (err) {
              if (err) {
                error = {message: 'Error publishing ascent'};
                return finish();
              }

              indexAscent(ascent);

              ascents.push(ascent);
              return finish();
            };

            if (!silent && req.user) {
              publishAscent(req.user, ascent, next);
            } else {
              next();
            }
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

  // Update
  app.put('/api/ascents/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    var props = req.body;
    var unset = {};

    // Ensure name is descriptive.
    if (props.name !== undefined && props.name.length < 2) {
      return res.send(403, {error: {type: 'LENGTH_INVALID', message:
          'Ascent name must be at least 2 characters'}});
    }

    // Possible unsets.
    if (props.sector && props.sector === '') {
      unset.sector = 1;
      delete props.sector;
    }
    if (props.note && props.note === '') {
      unset.note = 1;
      delete props.note;
    }
    if (props.tags && props.tags === '') {
      unset.tags = 1;
      delete props.tags;
    }

    // Skip if nothing to do.
    if (_.isEmpty(props) && _.isEmpty(unset)) {
      return res.send(403, {error: {message: 'Ascent empty'}});
    }

    db.Ascents.read({_id: db.oid(req.params.id)}, function (err, ascent) {
      if (errorHandler(err, req, res, ascent, 'ascent')) return;
      if ((!ascent.author_id || req.user._id.toString() !==
          ascent.author_id.toString()) && !req.user.admin) {
        return res.send(403, {error: {message: 'Member invalid'}});
      }

      // Update key if type changed.
      if (props.type) {
        var parts = ascent.key.split('/');
        var type = props.type === 'b' ? 'boulders': 'routes';
        props.key = [parts[0], parts[1], type, parts[3]].join('/');
      }

      var update = {};
      if (!_.isEmpty(props)) {
        update.$set = props;
      }
      if (!_.isEmpty(unset)) {
        update.$unset = unset;
      }

      db.Ascents.update({_id: ascent._id}, update, function (err, stat) {
        if (errorHandler(err, req, res, stat, 'ascent')) return;

        if (props.name) {
          ascent.name = props.name;
          indexAscent(ascent);
        }

        res.send({updated: true, key: props.key || ascent.key});
      });
    });
  });

  // Delete
  app.delete('/api/ascents/:id', function (req, res) {
    deleteAscent(req.params.id, req.user, function (err) {
      if (errorHandler(err, req, res)) return;
      res.send({removed: true});
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
      return res.send(403, {error: {message: 'Member invalid'}});
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
      return res.send(403, {error: {message: 'Member invalid'}});
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
};
