/*
 * ascent.js: Handling for the ascent resource.
 *
 */

// Module Dependencies
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
    "grade": <Number>.
    "consensus" : [
      { grade: <Number>, author_id: <ObjectId>, tick_id: <ObjectId> }
    ]
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

// calculate grade consensus. Alg details:
// - Find grade that appears most in the consensus
// - Select oldest if multiple exist
// - Grade cannot be Project (-1) if other grades exist
// - If consensus entry has tick_id, this ascent has been sent. All entries
//   not containing a tick_id are considered suggestions and aren't part
//   of the consensus.

var calculateGradeByConsensus =
    exports.calculateGradeByConsensus = function(consensus) {

  // If sent, don't include suggestions (ie, no tick_id)
  if (_.some(consensus, function(c) { return !!c.tick_id; })) {
    consensus = _.filter(consensus, function(c) { return !!c.tick_id; });
  }

  var byGrade = _.countBy(consensus, 'grade');

  // If grades exist other than -1 (Project), ignore Project grades
  if (byGrade['-1'] && _.keys(byGrade).length > 1) {
    delete byGrade['-1'];
  }

  var maxGrade = _.max(byGrade);
  var consensusGrades = [];
  _.each(byGrade, function(v, k) {
    if (maxGrade === v) {
      consensusGrades.push(Number(k));
    }
  });
  f = _.find(consensus, function(c) {
    return consensusGrades.indexOf(c.grade) !== -1;
  });
  return _.isUndefined(f) ? null : f.grade;
};

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
    cache.index('ascents', ascent, ['name', 'sector']);
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

  exports.removeConsensus = function(ascentId, memberId, cb) {
    if (_.isString(ascentId)) {
      ascentId = db.oid(ascentId);
    }
    if (_.isString(memberId)) {
      memberId = db.oid(memberId);
    }
    Step(
      function () {
        db.Ascents.read({_id: ascentId}, this);
      },
      function (err, ascent) {
        if (err) return cb(err);
        if (!ascent) {
          return cb('Ascent not found');
        }

        var consensus = ascent.consensus;
        consensus = _.filter(consensus, function(c) {
          if (!c.author_id) return true;
          return (c.author_id.toString() !== memberId.toString());
        });
        var newgrade = calculateGradeByConsensus(consensus);

        var update = {$set: {}};
        update.$set.consensus = consensus;
        if (newgrade !== ascent.grade) {
          update.$set.grade = newgrade;
        }
        db.Ascents.update({_id: ascent._id}, update, cb);
      }
    );
  };

  // update grade consensus in ascent document
  exports.updateConsensus = function(grade, ascent, member, tick, cb) {
    if (typeof tick === 'function') {
      cb = tick;
    }
    if (!grade) {
      return cb();
    }
    var consensus = ascent.consensus;
    // Remove old grade suggestion
    consensus = _.filter(consensus, function(c) {
      if (!c.author_id) return true;
      return (c.author_id.toString() !== member._id.toString());
    });
    consensus.push({
      grade: grade,
      author_id: member._id,
      tick_id: tick._id
    });
    var newgrade = calculateGradeByConsensus(consensus);

    var update = {$set: {}};
    update.$set.consensus = consensus;
    if (newgrade && newgrade !== ascent.grade) {
      update.$set.grade = newgrade;
    }
    db.Ascents.update({_id: ascent._id}, update, cb);
  };

  var moveAscent = exports.moveAscent = function (id, member, cragId, cb) {
    if (!member) {
      return cb({code: 403, error: {message: 'Member invalid'}});
    }
    if (_.isString(id)) {
      id = db.oid(id);
    }
    if (_.isString(cragId)) {
      cragId = db.oid(cragId);
    }

    // Get the crag.
    db.Crags.read({_id: cragId}, function (err, crag) {
      if (err) return cb(err);
      if (!crag) {
        return cb({error: {code: 404, message: 'Crag not found'}});
      }

      // Get the ascent.
      db.Ascents.read({_id: id}, function (err, ascent) {
        if (err) return cb(err);
        if (!ascent) {
          return cb({error: {code: 404, message: 'Ascent not found'}});
        }

        Step(
          function () {
            var keyParts = ascent.key.split('/');
            var update = {
              crag_id: crag._id,
              crag: crag.name,
              country_id: crag.country_id,
              country: crag.country,
              key: [crag.key, keyParts[2], keyParts[3]].join('/'),
              location: crag.location
            };
            _.extend(ascent, update);

            // Update ascent.
            db.Ascents.update({_id: ascent._id}, {$set: update,
                $unset: {'sector': 1}}, this.parallel());

            // Get ticks.
            db.Ticks.list({ascent_id: ascent._id}, this.parallel());
          },
          function (err, stat, ticks) {
            if (err) return this(err);
            if (!stat) {
              return this({error: {code: 404, message: 'Ascent not found'}});
            }
            if (ticks.length === 0) {
              return this();
            }

            Step(
              function () {
                var group = this.group();

                // Get tick session events.
                _.each(ticks, _.bind(function (tick) {
                  db.Events.list({action_id: tick.session_id,
                      action_type: 'session'}, group());
                }, this));
              },
              function (err, es) {
                if (err) return this(err);

                if (es.length > 0) {
                  _.each(_.flatten(es), function (e) {
                    events.publish('event', 'event.removed',
                        {data: {id: e._id.toString()}});
                  });
                }

                // Handle session, actions, and ticks.
                _.each(ticks, _.bind(function (tick) {

                  // Handle tick session.
                  db.Sessions._update({_id: tick.session_id}, {$set: {
                    crag_id: crag._id,
                    country_id: crag.country_id
                  }}, this.parallel());

                  // Handle tick session event.
                  db.Events._update({action_id: tick.session_id,
                      action_type: 'session'}, {$set: {
                    target_id: crag._id,
                    'data.target': {
                      s: ['crags', crag.key].join('/'),
                      l: crag.location,
                      n: crag.name,
                      c: crag.country
                    }
                  }}, this.parallel());

                  // Handle tick action.
                  db.Actions._update({_id: tick.action_id}, {$set: {
                    crag_id: crag._id,
                    country_id: crag.country_id
                  }}, this.parallel());

                  // Handle tick.
                  db.Ticks._update({_id: tick._id}, {$set: {
                    crag_id: crag._id,
                    country_id: crag.country_id
                  }}, this.parallel());

                  // Handle hangten events on the tick.
                  db.Events._update({target_id: tick._id,
                      action_type: 'hangten'}, {$set: {
                    'data.target.l': crag.name,
                  }}, {multi: true}, this.parallel());

                  // Handle comment events on the tick.
                  db.Events._update({target_id: tick._id,
                      action_type: 'comment'}, {$set: {
                    'data.target.l': crag.name,
                  }}, {multi: true}, this.parallel());

                }, this));

              },
              this
            );
          },
          function (err) {
            if (err) return this(err);

            // Get hangtens.
            db.Hangtens.list({parent_id: ascent._id}, this.parallel());

            // Get events from creation.
            db.Events.list({action_id: ascent._id, action_type: 'ascent'},
                this.parallel());

            // Handle events from creation.
            db.Events._update({action_id: ascent._id, action_type: 'ascent'},
                {$set: {
              target_id: crag._id,
              'data.action.c': crag.country,
              'data.action.s': ['crags', ascent.key].join('/')
            }}, {multi: true}, this.parallel());

            // Handle tick events.
            db.Events._update({target_id: ascent._id, action_type: 'tick'},
                {$set: {
              'data.target.s': ['crags', ascent.key].join('/'),
              'data.target.p': {
                s: ['crags', crag.key].join('/'),
                l: crag.location,
                n: crag.name,
                c: crag.country
              }
            }}, {multi: true}, this.parallel());

            // Handle post events.
            db.Events._update({target_id: ascent._id, action_type: 'post'},
                {$set: {
              'data.target.n': [ascent.name, crag.name, crag.country]
                  .join(', '),
              'data.target.s': ['crags', ascent.key].join('/')
            }}, {multi: true}, this.parallel());

          },
          function (err, hangtens, es) {
            if (err) {
              return this(err);
            }

            // Remove events from creation from UIs.
            _.each(es, function (e) {
              events.publish('event', 'event.removed',
                  {data: {id: e._id.toString()}});
            });

            if (hangtens.length === 0) {
              return this();
            }

            _.each(hangtens, _.bind(function (hangten) {
              db.Events._update({target_id: ascent._id, action_id: hangten._id},
                  {$set: {
                'data.target.l': crag.name,
                'data.target.s': ['crags', ascent.key].join('/') + '#h=' +
                    hangten._id.toString()
              }}, this.parallel());
            }, this));

          },
          cb
        );
      });
    });
  };

  var mergeAscents = exports.mergeAscents = function (ids, member, props, cb) {
    if (!member) {
      return cb({code: 403, error: {message: 'Member invalid'}});
    }
    ids = _.map(ids, function (id) {
      return _.isString(id) ? db.oid(id) : id;
    });

    // Ensure name is descriptive.
    if (props.name === undefined || props.name.length < 2) {
      return cb({error: {code: 403, type: 'LENGTH_INVALID',
          message: 'Ascent name must be at least 2 characters'}});
    }

    // Get the leader ascent.
    db.Ascents.read({_id: ids[0]}, function (err, leader) {
      if (err) return cb(err);
      if (!leader) {
        return cb({error: {code: 404, message: 'Ascent not found'}});
      }

      var keyParts = leader.key.split('/');
      var type = props.type === 'b' ? 'boulders': 'routes';
      var leaderKey = [keyParts[0], keyParts[1], type,
          _.slugify(props.name)].join('/');
      var consensus = [];
      var update = {
        name: props.name,
        rock: props.rock,
        type: props.type,
        grade: Number(props.grade),
        consensus: consensus,
        note: props.note,
        key: leaderKey,
      };

      Step(
        function () {

          // Get ascents.
          db.Ascents.list({_id: {$in: ids}}, this.parallel());

          // Get ticks
          db.Ticks.list({ascent_id: {$in: ids}}, this.parallel());

          // Get hangtens on leader.
          db.Hangtens.list({parent_id: leader._id}, this.parallel());
        },
        function (err, ascents, ticks, hangtens) {
          if (err) return this(err);
          if (ascents.length === 0 && ticks.length === 0 &&
              hangtens.length === 0) {
            return this();
          }

          // Handle other ascents.
          _.each(ascents, _.bind(function (ascent) {

            // Save consensus.
            consensus.push(ascent.consensus);

            // Move posts.
            db.Posts._update({parent_id: ascent._id}, {$set: {
              parent_id: leader._id
            }}, {multi: true}, this.parallel());

            // Handle post events.
            db.Events._update({target_id: ascent._id, action_type: 'post'},
                {$set: {
              target_id: leader._id,
              'data.target.i': leader._id.toString(),
              'data.target.n': [props.name, leader.crag, leader.country]
                  .join(', '),
              'data.target.s': ['crags', leaderKey].join('/')
            }}, {multi: true}, this.parallel());

            // Move ticks.
            db.Ticks._update({ascent_id: ascent._id}, {$set: {
              ascent_id: leader._id
            }}, {multi: true}, this.parallel());

            // Handle tick events.
            db.Events._update({target_id: ascent._id, action_type: 'tick'},
                {$set: {
              target_id: leader._id,
              'data.target.n': props.name,
              'data.target.t': props.type,
              'data.target.s': ['crags', leaderKey].join('/')
            }}, {multi: true}, this.parallel());

            // Move subscriptions.
            db.Subscriptions._update({subscribee_id: ascent._id}, {$set: {
              subscribee_id: leader._id
            }}, {multi: true}, this.parallel());

            // Delete the ascent.
            if (ascent._id.toString() !== leader._id.toString()) {
              deleteAscent(ascent._id, member, this.parallel());
            } else {
              // Handle events from creation.
              db.Events._update({action_id: ascent._id, action_type: 'ascent'},
                  {$set: {
                'data.action.n': props.name,
                'data.action.s': ['crags', leaderKey].join('/')
              }}, {multi: true}, this.parallel());
            }

          }, this));

          // Handle hangten and comment events on the tick.
          _.each(ticks, _.bind(function (tick) {
            db.Events._update({target_id: tick._id}, {$set: {
              'data.target.n': props.name,
            }}, {multi: true}, this.parallel());
          }, this));

          // Handle hangtens on leader.
          _.each(hangtens, _.bind(function (hangten) {
            db.Events._update({target_id: leader._id, action_id: hangten._id},
                {$set: {
              'data.target.n': props.name,
              'data.target.s': ['crags', leaderKey].join('/') + '#h=' +
                  hangten._id.toString()
            }}, this.parallel());
          }, this));

        },
        function (err) {
          if (err) return this(err);

          // Update leader's consensus.
          consensus = _.flatten(consensus);
          consensus = _.reject(consensus, function (c) {
            return !c.tick_id;
          });
          consensus = _.uniq(consensus, function (c) {
            return c.author_id;
          });
          consensus.unshift({ grade: leader.grade });
          var newgrade = calculateGradeByConsensus(consensus);
          update.consensus = consensus;
          update.grade = newgrade;

          // Update ascent.
          db.Ascents.update({_id: leader._id}, {$set: update,
              $unset: {'sector': 1}}, {force: {key: 1}}, this);
        },
        function (err, stat) {
          if (err) return this(err);
          if (!stat) {
            return this({error: {code: 404, message: 'Ascent not found'}});
          }

          // Read back the ascent (need the possibly forced key)
          db.Ascents.read({_id: leader._id}, this);
        },
        function (err, merged) {
          if (err) return cb(err);

          // Re-index.
          indexAscent(merged);

          cb(null, merged);
        }
      );
    });
  };

  var reKeyAscent = exports.reKeyAscent = function (id, member, cb) {
    if (!member) {
      return cb({code: 403, error: {message: 'Member invalid'}});
    }
    if (_.isString(id)) {
      id = db.oid(id);
    }

    // Get the ascent.
    db.Ascents.read({_id: id}, function (err, ascent) {
      if (err) return cb(err);
      if (!ascent) {
        return cb({error: {code: 404, message: 'Ascent not found'}});
      }

      // Get the crag.
      db.Crags.read({_id: ascent.crag_id}, function (err, crag) {
        if (err) return cb(err);
        if (!crag) {
          return cb({error: {code: 404, message: 'Crag not found'}});
        }

        var keyParts = ascent.key.split('/');
        var type = ascent.type === 'b' ? 'boulders': 'routes';
        var key = [crag.key, type, _.slugify(ascent.name)].join('/');
        var update = {key: key};

        Step(
          function () {

            // Get hangtens.
            db.Hangtens.list({parent_id: ascent._id}, this.parallel());

            // Get ticks.
            db.Ticks.list({ascent_id: ascent._id}, this.parallel());

            // Handle post events.
            db.Events._update({target_id: ascent._id, action_type: 'post'},
                {$set: {
              'data.target.n': [ascent.name, ascent.crag, ascent.country]
                  .join(', '),
              'data.target.s': ['crags', key].join('/')
            }}, {multi: true}, this.parallel());

            // Handle tick events.
            db.Events._update({target_id: ascent._id, action_type: 'tick'},
                {$set: {
              'data.target.n': ascent.name,
              'data.target.t': ascent.type,
              'data.target.s': ['crags', key].join('/')
            }}, {multi: true}, this.parallel());

            // Handle events from creation.
            db.Events._update({action_id: ascent._id, action_type: 'ascent'},
                {$set: {
              'data.action.n': ascent.name,
              'data.action.s': ['crags', key].join('/')
            }}, {multi: true}, this.parallel());

          },
          function (err, hangtens, ticks) {
            if (err) return this(err);
            if (hangtens.length === 0 && ticks.length === 0) {
              return this();
            }

            // Handle hangten and comment events on the tick.
            _.each(ticks, _.bind(function (tick) {
              db.Events._update({target_id: tick._id}, {$set: {
                'data.target.n': ascent.name
              }}, {multi: true}, this.parallel());
            }, this));

            // Handle hangtens.
            _.each(hangtens, _.bind(function (hangten) {
              db.Events._update({target_id: ascent._id, action_id: hangten._id},
                  {$set: {
                'data.target.n': ascent.name,
                'data.target.s': ['crags', key].join('/') + '#h=' +
                    hangten._id.toString()
              }}, this.parallel());
            }, this));

          },
          function (err) {
            if (err) return this(err);

            // Update ascent.
            db.Ascents.update({_id: ascent._id}, {$set: update,
                $unset: {'sector': 1}}, {force: {key: 1}}, this);
          },
          function (err, stat) {
            if (err) return this(err);
            if (!stat) {
              return this({error: {code: 404, message: 'Ascent not found'}});
            }

            // Read back the ascent (need the possibly forced key)
            db.Ascents.read({_id: ascent._id}, this);
          },
          function (err, updated) {
            if (err) return cb(err);

            // Re-index.
            indexAscent(updated);

            cb(null, updated.key);
          }
        );
      });
    });
  };

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
      if ((!doc.author_id || member._id.toString() !==
          doc.author_id.toString()) && !member.admin) {
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

  // Create one or many ascents. The silent tag indicates that
  // there shouldn't be an author associated with this post
  app.post('/api/ascents', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
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
        if (_.isArray(v) && v.length === 1) obj[k] = v[0];
      });
      res.send(obj);
    });

    _.each(req.body, function (props) {
      if (!_.isNumber(props.grade)) {
        props.grade = -1;
      }
      if (!props.crag_id || !props.type) {
        error = {code: 403, message: 'Invalid ascent props'};
        return finish();
      }
      if (props.name === undefined || props.name.length < 2) {
        error = {code: 403,
            message: 'Ascent name must be at least 2 characters'};
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
            crag: crag.name,
            country_id: crag.country_id,
            country: crag.country,
            key: [crag.key, props.type === 'b' ? 'boulders': 'routes',
                _.slugify(props.name)].join('/'),
            public: pub
          });
          if (!silent) {
            props.author_id = req.user._id;
          }
          if (crag.location) {
            props.location = crag.location;
          }
          props.consensus = [{grade: props.grade}];

          db.Ascents.create(props, {force: {key: 1}}, function (err, ascent) {
            if (err) {
              error = {message: 'Error adding ascent'};
              return finish();
            }

            mapAscentCragCount(ascent, '+', function () {});

            var next = function (err) {
              if (err) {
                error = {message: 'Error publishing ascent'};
                return finish();
              }

              indexAscent(ascent);

              ascents.push(ascent);
              return finish();
            };

            if (!silent) {
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
      if (errorHandler(err, req, res, doc, 'ascent')) return;
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

      var update = {};
      if (!_.isEmpty(props)) {
        update.$set = props;
      }
      if (!_.isEmpty(unset)) {
        update.$unset = unset;
      }

      // Remove old grade conensus
      if (props.grade) {
        var consensus = ascent.consensus;
        // Remove initial grade suggestion
        consensus.shift();
        consensus.unshift({ grade: props.grade });
        var newgrade = calculateGradeByConsensus(consensus);
        update.$set.consensus = consensus;
        update.$set.grade = newgrade;
      }

      var finish = function(err, key) {
        if (errorHandler(err, req, res)) return;
        res.send({updated: true, key: key || ascent.key});
      };

      db.Ascents.update({_id: ascent._id}, update, function (err, stat) {
        if (errorHandler(err, req, res, stat, 'ascent')) return;

        // Re-key if name or type changed.
        if (props.name || props.type) {
          reKeyAscent(ascent._id, req.user, finish);
        } else {
          finish();
        }
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

  // Delete multi.
  app.delete('/api/ascents', function (req, res) {
    if (!req.body.ascent_ids || req.body.ascent_ids.length === 0) {
      return res.send(400, {error: {message: 'Bad request'}});
    }

    Step(
      function () {
        _.each(req.body.ascent_ids, _.bind(function (id) {
          deleteAscent(id, req.user, this.parallel());
        }, this));
      },
      function (err) {
        if (errorHandler(err, req, res)) return;

        res.send({removed: true});
      }
    );
  });

  // Move to a different crag
  app.post('/api/ascents/move', function (req, res) {
    if (!req.user || !req.user.admin) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
    if (!req.body.crag_id || !req.body.ascent_ids ||
        req.body.ascent_ids.length === 0) {
      return res.send(400, {error: {message: 'Bad request'}});
    }

    Step(
      function () {
        _.each(req.body.ascent_ids, _.bind(function (id) {
          moveAscent(id, req.user, req.body.crag_id, this.parallel());
        }, this));
      },
      function (err) {
        if (errorHandler(err, req, res)) return;

        res.send({moved: true});
      }
    );
  });

  // Merge ascents.
  app.post('/api/ascents/merge', function (req, res) {
    if (!req.user || !req.user.admin) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
    if (!req.body.props || !req.body.props.name || !req.body.ascent_ids ||
        req.body.ascent_ids.length === 0) {
      return res.send(400, {error: {message: 'Bad request'}});
    }

    mergeAscents(req.body.ascent_ids, req.user, req.body.props,
        function (err, merged) {
      if (errorHandler(err, req, res)) return;
      console.log(merged)

      res.send({merged: true, key: merged.key});
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
          if (data.ascents[a.type][a.grade]) {
            data.ascents[a.type][a.grade].push(a);
          } else {
            data.ascents[a.type][a.grade] = [a];
          }
          ++data[a.type + 'cnt'];
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
          function (err) {
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
