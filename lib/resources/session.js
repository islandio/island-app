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
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    if (!req.body.crag_id || !req.body.date)
      return res.send(403, {error: 'Session invalid'});
    var props = req.body;

    // Get the crag.
    db.Crags.findOne({_id: db.oid(props.crag_id)}, function (err, crag) {
      if (com.error(err, req, res, crag, 'crag')) return;

      // Setup the session.
      props.key = com.createId_32();
      props.author_id = req.user._id;
      props.country_id = crag.country_id;
      props.crag_id = crag._id;
      props.date = new Date(Number(props.date));
      props.env = 0; // 0 = outside. TODO: handle indoor.
      if (props.name === '') delete props.name;
      if (props.note === '') delete props.note;

      // Remove actions from props.
      var actions = props.actions;
      delete props.actions;

      // Create the session.
      db.Sessions.create(props, {inflate: {author: profiles.member},
          force: {key: 1}}, function (err, doc) {
        if (com.error(err, req, res)) return;
        doc.crag = crag;

        Step(
          function () {
            if (!actions || actions.length === 0) return this();
            
            doc.actions = [];
            var next = _.after(actions.length, this);
            _.each(actions, function (action) {

              // Remove ticks from action.
              var ticks = action.ticks;
              delete action.ticks;

              // Create action.
              action.session_id = doc._id;
              action.author_id = doc.author_id;
              action.country_id = doc.country_id;
              action.crag_id = doc.crag_id;
              action.date = doc.date;
              action.env = doc.env;
              action.index = Number(action.index);
              action.type = Number(action.type);
              action.duration = Number(action.duration);
              if (isNaN(action.duration)) delete action.duration;
              action.performance = Number(action.performance);
              if (isNaN(action.performance)) delete action.performance;
              db.Actions.create(action, function (err, a) {
                if (com.error(err, req, res)) return;
                if (!ticks || ticks.length === 0) return next();

                a.ticks = [];
                var _next = _.after(ticks.length, function () {

                  // Add action to session (superficial - for publish).
                  doc.actions.push(a);
                  next();
                });
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
                    tick.index = Number(tick.index);
                    tick.type = String(tick.type);
                    tick.sent = tick.sent ? true: false;
                    tick.grade = Number(tick.grade);
                    if (isNaN(tick.grade)) delete tick.grade;
                    tick.feel = Number(tick.feel);
                    if (isNaN(tick.feel)) delete tick.feel;
                    tick.tries = Number(tick.tries);
                    if (isNaN(tick.tries)) delete tick.tries;
                    tick.rating = Number(tick.rating);
                    if (isNaN(tick.rating)) delete tick.rating;
                    var first = Number(tick.first);
                    if (!isNaN(first)) {
                      tick.first = false;
                      tick.firstf = false;
                      switch (first) {
                        case 0: default: break;
                        case 1: tick.first = true; break;
                        case 2: tick.firstf = true; break;
                      }
                    } else delete tick.first;
                    if (tick.note === '') delete tick.note;
                    db.Ticks.create(tick, {force: {key: 1}}, function (err, t) {
                      t.ascent = ascent;

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

                      // Add tick to action (superficial - for publish).
                      a.ticks.push(t);
                      _next();
                    });
                  });

                });
              });
            });
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Publish session.
            pubsub.publish('session', 'session.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: crag._id,
                action_id: doc._id,
                action_type: 'session',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'session',
                    b: _.prune(doc.note, 40),
                    n: doc.name,
                    d: doc.date.toISOString(),
                    s: ['sessions', doc.key].join('/')
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
            pubsub.subscribe(req.user, doc, {style: 'watch', type: 'session'});

            // Done.
            res.send({logged: true});
          }
        );

      });
    });
  
  });

  // Update (TODO)
  app.put('/api/sessions/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});
    res.send();
  });

  // Delete
  app.delete('/api/sessions/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the session.
    db.Sessions.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'session')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'Member invalid'});

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (com.error(err, req, res, event, 'event')) return;

        Step(
          function () {

            // Remove notifications for events where session is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
              if (events.length === 0) return this();
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
