/*
 * session.js: Handling for the session resource.
 *
 */

// Module Dependencies
var request = require('request');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');

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
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  function createSession(member, props, crag, cb) {

    // Setup the new session.
    props.key = iutil.createId_32();
    props.author_id = member._id;
    props.country_id = crag.country_id;
    props.crag_id = crag._id;
    props.date = new Date(Number(props.date));
    props.env = 0; // 0 = outside. TODO: handle indoor.
    if (props.name === '') {
      delete props.name;
    }
    iutil.removeEmptyStrings(props);

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

  function setupTick(tick, session, action, ascent, index, pub) {
    tick.key = tick.key || iutil.createId_32();
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
    tick.public = pub !== false;
  }

  function createMedia(parent, author, files, cb) {

    /*
     * files object
     * {
     *   image_full: [array]
     *   video_encode_hd: [array]
     *   etc
     * }
     */

    var objs = [];

    // We handle each of these potential media types slightly seperately
    _.each(files, function (v, k) {
      if (k !== 'image_full'
        && k !== 'image_full_gif'
        && k !== 'video_encode_iphone'
        && k !== 'video_encode_ipad'
        && k !== 'video_encode_hd'
        && k !== 'audio_encode') {
        return;
      }

      _.each(v, function (file) {
        var obj = {
          type: file.type,
          parent_id: parent,
          author_id: author
        };

        obj[file.type] = file;
        switch (k) {
          case 'image_full':
          case 'image_full_gif':
            _.extend(obj, {
              thumbs: _.filter(files.image_thumb, function (img) {
                  return img.original_id === file.original_id;
              })
            });
            break;
          case 'video_encode_iphone':
          case 'video_encode_ipad':
          case 'video_encode_hd':
            obj.quality = _.strRightBack(k, '_');
            _.extend(obj, {
              poster: _.find(files['video_poster_' + obj.quality],
                function (img) {
                  return img.original_id === file.original_id;
              }),
              thumbs: _.filter(files.video_thumbs, function (img) {
                  return img.original_id === file.original_id;
              })
            });
            break;
          case 'audio_encode': _.extend(obj, {}); break;
        }
        objs.push(obj);
      });
    });

    Step(
      function () {
        if (objs.length === 0) {
          return cb(null, []);
        }

        var group = this.group();
        _.each(objs, function (props) {
          db.Medias.create(props, group());
        });
      },
      function (err, medias) {
        cb(err, medias);
      }
    );
  };

  function publishSession(member, session, crag, cb) {
    session.crag = crag;
    session.comments = [];

    // Publish session.
    events.publish('session', 'session.new', {
      data: session,
      event: {
        actor_id: member._id,
        target_id: crag._id,
        action_id: session._id,
        action_type: 'session',
        data: {
          action: {
            i: member._id.toString(),
            a: member.displayName,
            g: member.gravatar,
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
    events.subscribe(member, session, {style: 'watch', type: 'session'});
    cb();
  }

  function publishTick(member, tick, session, ascent, crag, pub) {
    Step(
      function () {

        // Check if tick event exists.
        db.Events.read({action_id: tick._id}, this.parallel());

        // Inflate and fill.
        db.inflate(tick, {author: profiles.member}, this.parallel());
        db.fill(tick, 'Comments', 'parent_id', {sort: {created: -1},
            limit: 5, reverse: true, inflate: {author: profiles.member}},
            this.parallel());
        db.fill(tick, 'Hangtens', 'parent_id', this.parallel());
        db.fill(tick, 'Medias', 'parent_id', {sort: {created: -1}},
            this.parallel());
      },
      function (err, e) {
        if (err) return this(err);
        var params = {data: tick};
        if (e) {
          events.publish('tick', 'tick.removed', {data: {id: tick._id.toString()}});
          events.publish('event', 'event.removed', {data: {id: e._id.toString()}});

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
              },
              public: pub !== false
            }
          };
        } else {

          // Setup new tick event.
          params.event = {
            actor_id: member._id,
            target_id: ascent._id,
            action_id: tick._id,
            action_type: 'tick',
            data: {
              action: {
                i: member._id.toString(),
                a: member.displayName,
                g: member.gravatar,
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
            },
            public: pub !== false
          };
        }

        // Publish tick.
        events.publish('tick', 'tick.new', params);
      }
    );
  }

  function finishSession(err, member, session, crag, cb) {
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
            inflate: {author: profiles.member, ascent: profiles.ascent}}, this);
      },
      function (err) {
        if (err) return this(err);
        _.each(session.actions, _.bind(function (a) {
          db.fill(a.ticks, 'Comments', 'parent_id', {sort: {created: -1},
              limit: 5, reverse: true, inflate: {author: profiles.member}},
              this.parallel());
          db.fill(a.ticks, 'Hangtens', 'parent_id', this.parallel());
          db.fill(a.ticks, 'Medias', 'parent_id', {sort: {created: -1}},
              this.parallel());
        }, this));
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
          publishSession(member, session, crag, this);
        }
      }, cb
    );
  }

  var deleteSession = exports.deleteSession = function(id, member, cb) {
    if (!member) {
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
      if (member._id.toString() !== doc.author_id.toString()) {
        return cb({error: 'Member invalid'});
      }

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (err) return cb(err);

        Step(
          function () {

            // Remove notifications for events where session is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, es) {
              if (es.length === 0) {
                return this();
              }
              var _this = _.after(es.length, this);
              _.each(es, function (e) {

                // Publish removed status.
                events.publish('event', 'event.removed', {data: e});

                db.Notifications.list({event_id: e._id}, function (err, notes) {

                  // Publish removed statuses.
                  _.each(notes, function (note) {
                    events.publish('mem-' + note.subscriber_id.toString(),
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

            // Finally, remove the session.
            db.Sessions.remove({_id: doc._id}, this.parallel());
          },
          function (err) {
            if (err) return cb(err);

            // Publish removed status.
            if (event) {
              events.publish('event', 'event.removed', {data: event});
            }
            events.publish('session', 'session.removed', {data: {id: doc._id.toString()}});
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

    // Handle public.
    var pub = props.public === 'true' || props.public;
    delete props.public;

    // Get the crag.
    db.Crags.findOne({_id: db.oid(props.crag_id)}, function (err, crag) {
      if (errorHandler(err, req, res, crag, 'crag')) return;

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
                    if (errorHandler(err, req, res, ascent, 'ascent')) return;

                    // Create tick.
                    var media = tick.media;
                    delete tick.media;
                    var index = startIndex + Number(tick.index);
                    setupTick(tick, doc, a, ascent, index, pub);
                    db.Ticks.create(tick, {force: {key: 1}}, function (err, t) {
                      t.ascent = ascent;
                      createMedia(t._id, doc.author_id, media, function (err, medias) {
                        if (err) return _next(err);
                        publishTick(req.user, t, doc, ascent, crag, pub);
                        _next();
                      });
                    });
                  });
                });
              }
            );
          });
        },
        function (err) {
          if (errorHandler(err, req, res)) return;
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

    // Handle public.
    var pub = props.public === 'true' || props.public;
    delete props.public;

    // Get the tick.
    db.Ticks.findOne({_id: db.oid(req.params.id)}, function (err, tick) {
      if (errorHandler(err, req, res, tick, 'tick')) return;
      var existingSessionId = tick.session_id;

      db.Crags.findOne({_id: tick.crag_id}, function (err, crag) {
        if (errorHandler(err, req, res, crag, 'crag')) return;

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
                      if (errorHandler(err, req, res, ascent, 'ascent')) return;

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
                      var media = t.media;
                      delete t.media;
                      setupTick(t, doc, a, ascent, index, pub);
                      db.Ticks._update({_id: tick._id}, t, function (err) {
                        if (err) return _next(err);
                        t.ascent = ascent;
                        t._id = tick._id;

                        createMedia(t._id, doc.author_id, media,
                            function (err, medias) {
                          if (err) return _next(err);
                          publishTick(req.user, t, doc, ascent, crag, pub);
                          _next();
                        });
                      });
                    });
                  });
                }
              );
            });
          },
          function (err) {
            if (errorHandler(err, req, res)) return;
            res.send({updated: true});
          }
        );
      });
    });
  });

  return exports;
}
