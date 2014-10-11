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

    function _maxIndex(list) {
      if (!list) {
        return 0;
      }
      return _.max(list, function (i) { return i.index; }).index + 1;
    }

    // Get the crag.
    db.Crags.findOne({_id: db.oid(props.crag_id)}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

      function _publish(session, cb) {
        session.crag = crag;
        session.comments = [];

        // Publish session.
        pubsub.publish('session', 'session.new', {
          data: session,
          event: {
            actor_id: req.user._id,
            target_id: crag._id,
            action_id: session._id,
            action_type: 'session',
            data: {
              action: {
                i: req.user._id.toString(),
                a: req.user.displayName,
                g: req.user.gravatar,
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
        pubsub.subscribe(req.user, session, {style: 'watch', type: 'session'});

        cb();
      }

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
              date: {$gte: beg, $lte: end}}, this);
        },
        function (err, session) {
          if (err) return this(err);

          function _createSession(cb) {

            // Setup the session.
            props.key = com.createId_32();
            props.author_id = req.user._id;
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
            _createSession(this);
          }
        },
        function (err, doc) {
          if (err) return this(err);
          if (!actions || actions.length === 0) {
            return this();
          }

          function _createAction(action, cb) {
            action.session_id = doc._id;
            action.author_id = doc.author_id;
            action.country_id = doc.country_id;
            action.crag_id = doc.crag_id;
            action.date = doc.date;
            action.env = doc.env;
            action.index = Number(action.index);
            action.type = String(action.type);
            db.Actions.create(action, cb);
          }

          var next = _.after(actions.length, _.bind(function (err) {
            if (err) return this(err);

            // Re-read session with author, actions, and tick.
            Step(
              function () {
                db.inflate(doc, {author: profiles.member}, this.parallel());
                db.fill(doc, 'Actions', 'session_id', {sort: {index: 1}},
                    this.parallel());
              },
              function (err) {
                if (err) return this(err);
                db.fill(doc.actions, 'Ticks', 'action_id', {sort: {index: 1},
                    inflate: {ascent: profiles.ascent}}, this);
              },
              function (err) {
                if (com.error(err, req, res)) return;

                // If there's no event, publish one.
                db.Events.read({action_id: doc._id}, this);
              },
              function (err, e) {
                if (com.error(err, req, res)) return;
                if (e) {

                  // Update session 'updated' time.
                  db.Sessions.update({_id: doc._id}, {}, this);
                } else {
                  _publish(doc, this);
                }
              },
              function (err) {
                if (com.error(err, req, res)) return;
                res.send({logged: true});
              }
            );
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
                    action.index = _maxIndex(doc.actions)
                        + Number(action.index);
                    _createAction(action, this);
                  }
                } else {
                  _createAction(action, this);
                }
              },
              function (err, a) {
                if (err) return this(err);
                if (!ticks || ticks.length === 0) {
                  return next();
                }
                var startIndex = _maxIndex(a.ticks);
                var _next = _.after(ticks.length, next);
                _.each(ticks, function (tick) {

                  // Get the ascent.
                  db.Ascents.findOne({_id: db.oid(tick.ascent_id)},
                      function (err, ascent) {
                    if (com.error(err, req, res, ascent, 'ascent')) return;

                    // Create tick.
                    tick.key = com.createId_32();
                    tick.session_id = doc._id;
                    tick.author_id = doc.author_id;
                    tick.country_id = doc.country_id;
                    tick.crag_id = doc.crag_id;
                    tick.date = doc.date;
                    tick.env = doc.env;
                    tick.action_id = a._id;
                    tick.ascent_id = ascent._id;
                    tick.index = startIndex + Number(tick.index);
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
                    db.Ticks.create(tick, {force: {key: 1}}, function (err, t) {
                      t.ascent = ascent;
                      t.action = a;

                      // Publish tick.
                      pubsub.publish('tick', 'tick.new', {
                        data: t,
                        event: {
                          actor_id: req.user._id,
                          target_id: ascent._id,
                          action_id: t._id,
                          action_type: 'tick',
                          data: {
                            action: {
                              i: req.user._id.toString(),
                              a: req.user.displayName,
                              g: req.user.gravatar,
                              t: 'tick',
                              b: _.prune(t.note, 40),
                              d: t.date.toISOString(),
                              s: ['sessions', doc.key].join('/'),
                              m: {
                                s: t.sent,
                                g: t.grade,
                                t: t.tries
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
                        }
                      });

                      _next();
                    });
                  });

                });

              }
            );
          });
        }
      );
    });
  });

  // Update (TODO)
  app.put('/api/sessions/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }
    res.send();
  });

  // Delete
  app.delete('/api/sessions/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the session.
    db.Sessions.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'session')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: 'Member invalid'});
      }

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (com.error(err, req, res, event, 'event')) return;

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
            if (com.error(err, req, res)) return;

            // Publish removed status.
            pubsub.publish('event', 'event.removed', {data: event});

            res.send({removed: true});
          }
        );
      
      });
    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
