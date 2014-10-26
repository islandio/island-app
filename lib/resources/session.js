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
var request = require('request');

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

  function createSession(user, props, crag, cb) {

    // Setup the new session.
    props.key = com.createId_32();
    props.author_id = user._id;
    props.country_id = crag.country_id;
    props.crag_id = crag._id;
    props.date = new Date(Number(props.date));
    props.env = 0; // 0 = outside. TODO: handle indoor.
    if (props.name === '') {
      delete props.name;
    }

    // Create a new session.
    db.Sessions.create(props, {force: {key: 1}}, cb);
  }

  function createAction(action, session, cb) {
    action.session_id = session._id;
    action.author_id = session.author_id;
    action.country_id = session.country_id;
    action.crag_id = session.crag_id;
    action.date = session.date;
    action.env = session.env;
    action.index = Number(action.index);
    action.type = String(action.type);
    db.Actions.create(action, cb);
  }

  function setupTick(tick, session, action, ascent, index) {
    tick.key = tick.key || com.createId_32();
    tick.session_id = session._id;
    tick.author_id = session.author_id;
    tick.country_id = session.country_id;
    tick.crag_id = session.crag_id;
    tick.date = session.date;
    tick.env = session.env;
    tick.action_id = action._id;
    tick.ascent_id = ascent._id;
    tick.index = index;
    tick.type = String(tick.type);
    tick.duration = Number(tick.duration);
    if (isNaN(tick.duration)) {
      delete tick.duration;
    }
    tick.performance = Number(tick.performance);
    if (isNaN(tick.performance)) {
      delete tick.performance;
    }
    tick.sent = tick.sent ? true: false;
    tick.grade = Number(tick.grade);
    if (isNaN(tick.grade)) {
      delete tick.grade;
    }
    tick.feel = Number(tick.feel);
    if (isNaN(tick.feel)) {
      delete tick.feel;
    }
    tick.tries = Number(tick.tries);
    if (isNaN(tick.tries)) {
      delete tick.tries;
    }
    tick.rating = Number(tick.rating);
    if (isNaN(tick.rating)) {
      delete tick.rating;
    }
    var first = Number(tick.first);
    if (!isNaN(first)) {
      tick.first = false;
      tick.firstf = false;
      switch (first) {
        case 0: default: break;
        case 1: tick.first = true; break;
        case 2: tick.firstf = true; break;
      }
    } else {
      delete tick.first;
    }
    if (tick.note === '') {
      delete tick.note;
    }
  }

  function publishSession(user, session, crag, cb) {
    session.crag = crag;
    session.comments = [];

    // Publish session.
    pubsub.publish('session', 'session.new', {
      data: session,
      event: {
        actor_id: user._id,
        target_id: crag._id,
        action_id: session._id,
        action_type: 'session',
        data: {
          action: {
            i: user._id.toString(),
            a: user.displayName,
            g: user.gravatar,
            t: 'session',
            b: _.prune(session.note, 40),
            n: session.name,
            d: session.date.toISOString(),
            s: ['sessions', session.key].join('/')
          },
          target: {
            s: ['crags', crag.key].join('/'),
            l: crag.location,
            n: crag.name,
            c: crag.country
          }
        }
      }
    });

    // Subscribe actor to future events.
    pubsub.subscribe(user, session, {style: 'watch', type: 'session'});
    cb();
  }

  function publishTick(user, tick, session, ascent, crag) {
    Step(
      function () {

        // Check if tick event exists.
        db.Events.read({action_id: tick._id}, this);
      },
      function (err, e) {
        if (err) return this(err);
        var params = {data: tick};
        if (e) {

          // Update tick event.
          params.event = {
            _id: e._id,
            $set: {
              date: tick.date,
              'data.action.b': _.prune(tick.note, 40),
              'data.action.d': tick.date.toISOString(),
              'data.action.s': ['sessions', session.key].join('/'),
              'data.action.m': {
                s: tick.sent,
                g: tick.grade,
                t: tick.tries
              }
            }
          };
        } else {

          // Setup new tick event.
          params.event = {
            actor_id: user._id,
            target_id: ascent._id,
            action_id: tick._id,
            action_type: 'tick',
            data: {
              action: {
                i: user._id.toString(),
                a: user.displayName,
                g: user.gravatar,
                t: 'tick',
                b: _.prune(tick.note, 40),
                d: tick.date.toISOString(),
                s: ['sessions', session.key].join('/'),
                m: {
                  s: tick.sent,
                  g: tick.grade,
                  t: tick.tries
                }
              },
              target: {
                n: ascent.name,
                g: ascent.grades,
                t: ascent.type,
                s: ['crags', ascent.key].join('/'),
                p: {
                  s: ['crags', crag.key].join('/'),
                  l: crag.location,
                  n: crag.name,
                  c: crag.country
                }
              }
            }
          };
        }

        // Publish tick.
        pubsub.publish('tick', 'tick.new', params);
      }
    );
  }

  function finishSession(err, user, session, crag, cb) {
    if (err) return cb(err);

    // Re-read session with author, actions, and tick.
    Step(
      function () {
        db.inflate(session, {author: profiles.member}, this.parallel());
        db.fill(session, 'Actions', 'session_id', {sort: {index: 1}},
            this.parallel());
      },
      function (err) {
        if (err) return this(err);
        db.fill(session.actions, 'Ticks', 'action_id', {sort: {index: 1},
            inflate: {ascent: profiles.ascent}}, this);
      },
      function (err) {
        if (err) return this(err);

        // If there's no event, publish one.
        db.Events.read({action_id: session._id}, this);
      },
      function (err, e) {
        if (err) return this(err);
        if (e) {

          // Update session 'updated' time.
          db.Sessions.update({_id: session._id}, {}, this);
        } else {
          publishSession(user, session, crag, this);
        }
      }, cb
    );
  }

  function deleteSession(id, user, cb) {
    if (!user) {
      return cb({error: 'Member invalid'});
    }
    if (_.isString(id)) {
      id = db.oid(id);
    }

    // Get the session.
    db.Sessions.read({_id: id}, function (err, doc) {
      if (err || !doc) {
        return cb(err || {error: 'Session not found'});
      }
      if (user._id.toString() !== doc.author_id.toString()) {
        return cb({error: 'Member invalid'});
      }

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (err) return cb(err);

        Step(
          function () {

            // Remove notifications for events where session is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
              if (events.length === 0) {
                return this();
              }
              var _this = _.after(events.length, this);
              _.each(events, function (e) {

                // Publish removed status.
                pubsub.publish('event', 'event.removed', {data: e});

                db.Notifications.list({event_id: e._id}, function (err, notes) {

                  // Publish removed statuses.
                  _.each(notes, function (note) {
                    pubsub.publish('mem-' + note.subscriber_id.toString(),
                        'notification.removed', {data: {id: note._id.toString()}});
                  });
                });
                db.Notifications.remove({event_id: e._id}, _this);
              });
            }, this));
          },
          function (err) {
            if (err) return this(err);

            // Get all ticks.
            db.Ticks.list({session_id: doc._id}, this);
          },
          function (err, ticks) {
            if (err) return this(err);

            // Publish ticks removed.
            _.each(ticks, function (t) {
              pubsub.publish('tick', 'tick.removed', {data: {id: t._id.toString()}});
            });

            // Remove content on session.
            db.Comments.remove({parent_id: doc._id}, this.parallel());
            db.Hangtens.remove({parent_id: doc._id}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());
            db.Actions.remove({session_id: doc._id}, this.parallel());
            db.Ticks.remove({session_id: doc._id}, this.parallel());

            // Finally, remove the session.
            db.Sessions.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (err) return cb(err);

            // Publish removed status.
            if (event) {
              pubsub.publish('event', 'event.removed', {data: event});
            }
            pubsub.publish('session', 'session.removed', {data: {id: doc._id.toString()}});
            cb();
          }
        );
      
      });
    });
  }

  function maxIndex(list) {
    if (!list) {
      return 0;
    }
    return _.max(list, function (i) { return i.index; }).index + 1;
  }

  // Create
  app.post('/api/sessions', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    if (!req.body.crag_id || !req.body.date) {
      return res.send(403, {error: 'Session invalid'});
    }
    var props = req.body;

    // Remove actions from props.
    var actions = props.actions;
    delete props.actions;

    // Get the crag.
    db.Crags.findOne({_id: db.oid(props.crag_id)}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

      Step(
        function () {

          // Determine the day span of the session.
          var date = new Date(props.date);
          var beg = new Date(date.getFullYear(), date.getMonth(),
              date.getDate());
          var end = new Date(date.getFullYear(), date.getMonth(),
              date.getDate(), 23, 59, 59, 999);

          // Check if there's an older session from this crag on the same day.
          db.Sessions.read({author_id: req.user._id, crag_id: crag._id,
              date: {$gte: beg, $lte: end}}, this.parallel());
          if (crag.location) {
            var weatherURL = 'https://api.forecast.io/forecast/'
                + app.get('FORECASTIO_API') + '/'
                + crag.location.latitude + ','
                + crag.location.longitude;
            request.get(weatherURL, this.parallel());
          }
        },
        function (err, session, weather) {
          if (err) return this(err);

          if (weather) {
            weather = JSON.parse(weather.body).currently;

            var weatherWeCareAbout = {};
            weatherWeCareAbout.icon = weather.icon;
            weatherWeCareAbout.temperature = weather.temperature;
            weatherWeCareAbout.humidity = weather.humidity;
            weatherWeCareAbout.windSpeed = weather.windSpeed;
            weatherWeCareAbout.cloudCover = weather.cloudCover;
            weatherWeCareAbout.precipType = weather.precipType;

            props.weather = weatherWeCareAbout;
          }

          // Use older session if it exists.
          if (session) {
            var self = this;
            Step(
              function () {
                db.fill(session, 'Actions', 'session_id', {sort: {index: 1}},
                    this);
              },
              function (err) {
                if (err) return this(err);
                db.fill(session.actions, 'Ticks', 'action_id', {sort: {index: 1},
                    inflate: {ascent: profiles.ascent}}, this);
              },
              function (err) {
                self(err, session);
              }
            );
          } else {
            createSession(req.user, props, crag, this);
          }
        },
        function (err, doc) {
          if (err) return this(err);
          if (!actions || actions.length === 0) {
            return this();
          }

          // var next = _.after(actions.length, _.partial(finishSession, _,
          //       req.user, doc, crag, this));
          var next = _.after(actions.length, _.bind(function (err) {
            finishSession(err, req.user, doc, crag, this);
          }, this));
          _.each(actions, function (action, i) {

            // Grab new tick.
            var ticks = action.ticks;
            delete action.ticks;

            Step(
              function () {

                // Use old action if one exists.
                if (doc.created) {
                  var old = _.find(doc.actions, function (a) {
                    return a.type === action.type;
                  });
                  if (old) {
                    this(null, old);
                  } else {
                    action.index = maxIndex(doc.actions)
                        + Number(action.index);
                    createAction(action, doc, this);
                  }
                } else {
                  createAction(action, doc, this);
                }
              },
              function (err, a) {
                if (err) return this(err);
                if (!ticks || ticks.length === 0) {
                  return next();
                }
                var startIndex = maxIndex(a.ticks);
                var _next = _.after(ticks.length, next);
                _.each(ticks, function (tick) {

                  // Get the ascent.
                  db.Ascents.findOne({_id: db.oid(tick.ascent_id)},
                      function (err, ascent) {
                    if (com.error(err, req, res, ascent, 'ascent')) return;

                    // Create tick.
                    var index = startIndex + Number(tick.index);
                    setupTick(tick, doc, a, ascent, index);
                    db.Ticks.create(tick, {force: {key: 1}}, function (err, t) {
                      t.ascent = ascent;
                      t.action = a;
                      publishTick(req.user, t, doc, ascent, crag);
                      _next();
                    });
                  });
                });
              }
            );
          });
        }, function (err) {
          if (com.error(err, req, res)) return;
          res.send({logged: true});
        }
      );
    });
  });

  // Update
  app.put('/api/sessions/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    if (!req.body.crag_id || !req.body.date) {
      return res.send(403, {error: 'Session invalid'});
    }
    var props = req.body;

    // Remove actions from props.
    var actions = props.actions;
    delete props.actions;

    // Get the tick.
    db.Ticks.findOne({_id: db.oid(req.params.id)}, function (err, tick) {
      if (com.error(err, req, res, tick, 'tick')) return;
      var existingSessionId = tick.session_id;

      db.Crags.findOne({_id: tick.crag_id}, function (err, crag) {
        if (com.error(err, req, res, crag, 'crag')) return;

        Step(
          function () {

            // Determine the day span of the session.
            var date = new Date(props.date);
            var beg = new Date(date.getFullYear(), date.getMonth(),
                date.getDate());
            var end = new Date(date.getFullYear(), date.getMonth(),
                date.getDate(), 23, 59, 59, 999);

            // Read the tick's session. If the date is different, the seesion
            // will need changing / creating.
            db.Sessions.read({author_id: req.user._id, crag_id: crag._id,
                date: {$gte: beg, $lte: end}}, this);
          },
          function (err, session) {
            if (err) return this(err);

            // Use older session if it exists.
            if (session) {
              var self = this;
              Step(
                function () {
                  db.fill(session, 'Actions', 'session_id', {sort: {index: 1}},
                      this);
                },
                function (err) {
                  if (err) return this(err);
                  db.fill(session.actions, 'Ticks', 'action_id', {sort: {index: 1},
                      inflate: {ascent: profiles.ascent}}, this);
                },
                function (err) {
                  self(err, session);
                }
              );
            } else {
              createSession(req.user, props, crag, this);
            }
          },
          function (err, doc) {
            if (err) return this(err);
            if (!actions || actions.length === 0) {
              return this();
            }

            var next = _.after(actions.length, _.bind(function (err) {
              // Delete existing session if there are no ticks left.
              Step(
                function () {
                  db.Ticks.list({session_id: existingSessionId}, this);
                },
                function (err, ticks) {
                  if (err) return this(err);
                  if (ticks.length === 0) {
                    deleteSession(existingSessionId, req.user, this)
                  } else {
                    this();
                  }
                },
                function (err) {
                  if (err) return this(err);
                  finishSession(null, req.user, doc, crag, this);
                }, this
              );
            }, this));
            _.each(actions, function (action) {

              // Grab new tick.
              var ticks = action.ticks;
              delete action.ticks;

              Step(
                function () {

                  // Use old action if one exists.
                  if (doc.created) {
                    var old = _.find(doc.actions, function (a) {
                      return a.type === action.type;
                    });
                    if (old) {
                      this(null, old);
                    } else {
                      action.index = maxIndex(doc.actions)
                          + Number(action.index);
                      createAction(action, doc, this);
                    }
                  } else {
                    createAction(action, doc, this);
                  }
                },
                function (err, a) {
                  if (err) return this(err);
                  if (!ticks || ticks.length === 0) {
                    return next();
                  }
                  var startIndex = maxIndex(a.ticks);
                  var _next = _.after(ticks.length, next);
                  _.each(ticks, function (t) {

                    // Get the ascent.
                    db.Ascents.findOne({_id: db.oid(t.ascent_id)},
                        function (err, ascent) {
                      if (com.error(err, req, res, ascent, 'ascent')) return;

                      // Update tick.
                      var index = Number(tick.index);
                      // If tick is swtiching actions, then index should be updated
                      // to coordinate with new action's tick indexes.
                      if (tick.action_id.toString() !== a._id.toString()) {
                        index += startIndex;
                      }
                      t.key = tick.key;
                      t.created = tick.created;
                      t.updated = new Date;
                      setupTick(t, doc, a, ascent, index);
                      db.Ticks._update({_id: tick._id}, t, function (err) {
                        if (err) return _next(err);
                        t.ascent = ascent;
                        t.action = a;
                        t._id = tick._id;

                        // Remove old tick from clients.
                        pubsub.publish('tick', 'tick.removed', {data: {id: tick._id.toString()}});

                        // Publish new tick.
                        publishTick(req.user, t, doc, ascent, crag);
                        _next();
                      });
                    });
                  });
                }
              );
            });
          },
          function (err) {
            if (com.error(err, req, res)) return;
            res.send({logged: true});
          }
        );
      });
    });
  });

  // Delete
  app.delete('/api/sessions/:id', function (req, res) {
    deleteSession(req.params.id, req.user, function (err) {
      if (com.error(err, req, res)) return;
      res.send({removed: true});
    });
  });

  app.get('/api/sessions', function (req, res) {

    if (!req.user) return res.send(403, {error: 'Member invalid'});

    db.Ticks.list({author_id: req.user._id},
        {inflate: {ascent: profiles.ascent}}, function (err, ticks) {
      if (com.error(err, req, res)) return;

      if (req.query && req.query['csv']) {
        // Make a csv
        var csv = '';
        function addLine(strs) { csv += strs.join() + '\r\n' }
        addLine(['Date', 'Name', 'Crag', 'Type', 'Sent', 'Grade', 'Felt',
            'Tries', 'My rating']);
        _.each(ticks, function (t) {
          addLine([
              new Date(t.date).toDateString(),
              t.ascent.name, t.ascent.crag,
              t.type === 'r' ? 'Route' : t.type === 'b' ? 'Boulder' : 'Unknown',
              t.sent === true ? 'Sent' : '',
              t.ascent.grades[0], t.feel, t.tries, t.rating
          ]);
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition',
            'attachment; filename=' + req.user.displayName.trim() + ' - Island Tick List.csv')
        res.send(csv);
      } else {
        res.send(ticks);
      }
    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
