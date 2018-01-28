/*
 * events.js: Handling for the event resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('@islandio/util');
var Step = require('step');
var _ = require('underscore');
var _s = require('underscore.string');
var authorize = require('./member').authorize;
var collections = require('@islandio/collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../../app');
var GradeConverter = new require('../../public/js/GradeConverter').GradeConverter;

var gradeConverter = {
  'b': new GradeConverter('boulders').from('font').to('default'),
  'r': new GradeConverter('routes').from('french').to('default')
};

/* e.g.,

  event: {
    "_id": <ObjectId>,
    "data": {
      "action": {
        "a": <String>, (actor member displayName)
        "g": <String>, (actor md5 email hash)
        "t": <String>, (action type: comment, tick, star, follow, etc.)
        "b": <String>, (action message)
      },
      "target": {
        "a": <String>, (target member displayName)
        "n": <String>, (target title)
        "t": <String>, (target type: post, crag, ascent, etc.)
        "s": <String>, (slug)
      }
    },
    "actor_id": <ObjectId>,
    "target_id": <ObjectId>,
    "action_id": <ObjectId>,
    "action_type": <String>,
    "public": <Boolean>,
    "date": <ISODate>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }

Example:

1. A new session:
  actor_id: Posting user's id
  target_id: Ascent's id
  action_id: Tick's id
  action_type: tick
  data: {
    action: {
      i: posting user's id
      a: posting user's display name
      g: posting user's gravatar
      v: posting user's avatar
      t: action type is 'tick'
      b: The comment associated with this session
      d: tick date
      s: session key
      m: {
        s: tick sent status
        g: tick grade status
        t: tick tries
      }
    }
    target: {
      n: ascents name
      g: ascents grades
      t: ascent type, boulder'b' or route'r'
      s: ascent key
      p: {
        s: crag key
        l: crag location
        n: crag name
        c: crag country
      }
    }
  }


*/

// Parse string for vimeo and youtube links.
function _getVideoLinks(str) {
  if (!str) return [];

  var tests = [
    {
      type: 'vimeo',
      rx: /vimeo.com\/(?:channels\/|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/ig,
      id: 3
    },
    {
      type: 'youtube',
      rx: /(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>\s]+)/ig,
      id: 5
    }
  ];
  var results = [];
  _.each(tests, function (test) {
    var match;
    while (match = test.rx.exec(str)) {
      results.push({id: match[test.id], type: test.type});
    }
  });

  results = _.uniq(results, function (r) {
    return r.id;
  });

  results = _.map(results, function (r) {
    switch (r.type) {
      case 'vimeo':
        r.link = 'https://player.vimeo.com/video/' + r.id + '?api=1';
        break;
      case 'youtube':
        r.link = '//www.youtube.com/embed/' + r.id;
        break;
    }
    return r;
  });

  return results;
}

// Do any initializations
exports.init = function () {
  return this.routes();
};

// Build feed for member.
exports.feed = function (query, actions, options, cb) {
  var db = app.get('db');
  var events = app.get('events');

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  var cursor = options.cursor || 0;
  delete options.cursor;
  options.limit = options.limit || 5;
  options.skip = cursor * options.limit;
  options.sort = options.sort || {date: -1, created: -1};
  var subscription;

  // Handle query.
  if (query.action) {
    delete query.member_id;
    _getEventsByAction(_s.capitalize(query.action.type) + 's',
        query.action.query, _finish);
  } else {
    if (query.subscribee_id) {
      Step(
        function () {
          if (query.subscribee_type === 'member') {
            if (!query.member_id) {
              this();
            } else if (query.member_id.toString() === query.subscribee_id.toString()) {
              this(null, 'pass');
            } else {
              db.Subscriptions.read({subscriber_id: query.member_id,
                  subscribee_id: query.subscribee_id}, this);
            }
          } else if (query.member_id && query.subscribee_id) {
            db.Subscriptions.read({subscriber_id: query.member_id,
                subscribee_id: query.subscribee_id}, _.bind(function (err, sub) {
              if (err) return this(err);
              subscription = sub;
              this(null, 'pass');
            }, this));
          } else {
            this(null, 'pass');
          }
        },
        function (err, sub) {
          if (err) return cb(err);
          if (sub !== 'pass') {
            if ((!sub || sub.meta.style !== 'follow' || sub.mute) &&
                query.subscribee_privacy.toString() === '1') {
              return cb(null, {
                events: {items:[]},
                subscription: sub,
                private: true
              });
            } else {
              subscription = sub;
            }
          }
          _getEventsBySubscription([query.subscribee_id], _finish);
        }
      );
    } else if (query.subscriber_id) {
      db.Subscriptions.list({subscriber_id: query.subscriber_id, mute: false,
          $or: [{'meta.style': 'follow'}, {'meta.style': 'watch'}]},
      function (err, subs) {
        if (err) return cb(err);

        // Consolidate subscribees.
        var subscribees = _.pluck(subs, 'subscribee_id');
        _getEventsBySubscription(subscribees, _finish);
      });
    } else if (query.all) {
      _getEventsBySubscription([], true, _finish);
    } else if (query.public) {
      _getPopularPublicEvents(_finish);
    } else {
      cb(null, {events: {items:[]}});
    }
  }

  function _finish(err, es) {
    if (err) return cb(err);
    var n = es ? es.length: 0;
    es = _.reject(es, function (e) {
      var reject = e._reject || (app.get('package').beta &&
          !e.action.author.invited);
      if (reject) {
        return true;
      }
      delete e._reject;
      if (query.media) {
        var str = e.action.body || e.action.note;
        return e.action.medias.length === 0 &&
            _getVideoLinks(str).length === 0 && e.action.type !== 'instagram';
      }
      return false;
    });
    cb(null, {
      events: {
        cursor: ++cursor,
        more: n === options.limit,
        limit: options.limit,
        sort: options.sort,
        actions: actions,
        query: query,
        items: es || []
      },
      subscription: subscription
    });
  }

  function modifyTickQuery(query, cb) {
    if (typeof query.author_id === 'string') {
      query.author_id = db.oid(query.author_id);
    }
    // Note: can't do this query from client because Date object will
    // get stringified. So we send startdate and enddate instead of this query.
    if (query.startdate) {
      if (!query.date) query.date = {};
      query.date['$gte'] = new Date(query.startdate);
      delete query.startdate;
    }
    if (query.enddate) {
      if (!query.date) query.date = {};
      query.date['$lte'] = new Date(query.enddate);
      delete query.enddate;
    }
    if (query.tries && typeof query.tries === 'string') {
      if (query.tries === 'onsight') query.tries = 1;
      else if (query.tries === 'flash') query.tries = 2;
      else if (query.tries === 'redpoint') {
        // query for tries >= 3 or tries not existing
        query['$and'] = [{'$or':
            [{tries: {'$gte': 3}}, {tries: {'$exists': false}}]}];
        delete query.tries;
      }
    }
    if (query.grade && typeof query.grade === 'object' &&
        query.grade.val && query.grade.system && query.grade.type) {

      var gradeIdx = gradeConverter[query.grade.type]
          .indexRangeOf(query.grade.val, query.grade.system)
      delete query.grade;

      Step (
        function() {
          db.Ticks.list(query, {inflate: {ascent: profiles.ascent}}, this);
        },
        function(err, ticks) {
          if (err) return cb(err);
          var ascentIds = _.chain(ticks)
              .filter(function(t) {
                var found =  _.reduce(gradeIdx, function(m, g) {
                    var n = m || (t.ascent.grade === g);
                    return n;
                  }, false);
                return _.isUndefined(t.grade) && found;
              })
              .pluck('ascent')
              .pluck('_id')
              .value();
          var ascentQuery = {'$in': ascentIds};
          var gradeQuery = {'$in': gradeIdx};
          if (!query['$and']) query['$and'] = [];
          // query for grades in tick or ascent if ungraded
          query['$and'] = query['$and']
              .concat([{'$or': [{ascent_id: ascentQuery}, {grade: gradeQuery}]}]);
          return cb();
        }
      );
    } else {
      return cb();
    }
  }

  // Get event by first finding actions by query.
  function _getEventsByAction(type, query, cb) {
    Step(
      function() {
        if (type === 'Ticks') {
          modifyTickQuery(query, this);
        }
        else
          return this;
      },
      function(err) {
        if (err) return this(err);
        db[type].list(query, options, this);
      },
      function(err, docs) {
        if (err) return cb(err);
        if (docs.length === 0) return cb();

        // Prepare events.
        var es = new Array(docs.length);
        var _cb = _.after(docs.length, function (err) {
          cb(err, _.filter(es, function (e) { return e; }));
        });

        _.each(docs, function (d, i) {

          // Get action's event.
          db.Events.read({action_id: d._id}, function (err, e) {
            if (err) return this(err);
            if (!e) {
              return _cb();
            }
            e.action = d;
            es[i] = e;
            events.inflate(e, query, _cb);
          });
        });
      }
    );
  }

  // Get events related to subscriptions.
  function _getEventsBySubscription(subscribees, all, cb) {
    if (typeof all === 'function') {
      cb = all;
      all = null;
    }
    var eventQ = {action_type: {$in: actions}};
    if (all) {
      eventQ.public = {$ne: false};
    } else {
      eventQ.$or = [
        {actor_id: {$in: subscribees}, public: {$ne: false}},
        {target_id: {$in: subscribees}}
      ];
    }
    if (query.member_id) {
      if ((query.subscriber_id &&
          query.member_id.toString() === query.subscriber_id.toString()) ||
          (query.subscribee_id &&
          query.member_id.toString() === query.subscribee_id.toString())) {
        eventQ.$or.push({actor_id: query.member_id});
      }
    }
    db.Events.list(eventQ, options, function (err, es) {
      if (err) return cb(err);
      if (es.length === 0) {
        return cb();
      }

      // Prepare events.
      var _cb = _.after(es.length, function (err) { cb(err, es); });
      _.each(es, function (e) {

        // Inflate event action.
        db.inflate(e, {action: {collection: e.action_type, '*': 1}},
            function (err) {
          if (err) return _cb(err);

          // Prepare event.
          events.inflate(e, query, _cb);
        });
      });
    });
  }

  // Get public events.
  function _getPopularPublicEvents(cb) {
    Step(
      function () {
        db.Members.list({username: 'island'}, this);
      },
      function (err, exclude) {
        if (err) return cb(err);
        var eventQ = {
          action_type: {$in: actions},
          public: {$ne: false},
          actor_id: {$nin: _.map(exclude, function (u) { return u._id; })}
        };
        options.sort = {vcnt: -1, created: -1};
        db.Events.list(eventQ, options, function (err, es) {
          if (err) return cb(err);
          if (es.length === 0) return cb();

          // Prepare events.
          var _cb = _.after(es.length, function (err) { cb(err, es); });
          _.each(es, function (e) {

            // Inflate event action.
            db.inflate(e, {action: {collection: e.action_type, '*': 1}},
                function (err) {
              if (err) return _cb(err);

              // Prepare event.
              events.inflate(e, query, _cb);
            });
          });
        });
      }
    );
  }
};

// Define routes for this resource.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');

  // List
  app.post('/api/events/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var sort = req.body.sort;
    var query = req.body.query || {};
    var actions = req.body.actions || ['session', 'post', 'crag', 'ascent'];
    if (typeof query.subscribee_id === 'string') {
      query.subscribee_id = db.oid(query.subscribee_id);
    }
    if (typeof query.subscriber_id === 'string') {
      query.subscriber_id = db.oid(query.subscriber_id);
    }
    if (req.user) {
      query.member_id = req.user._id;
    }

    exports.feed(query, actions, {limit: limit, cursor: cursor, sort: sort},
        function (err, feed) {
      if (errorHandler(err, req, res)) return;

      if (req.body.media) {
        var items = [];
        _.each(feed.events.items, function (e) {
          var str = e.action.body || e.action.note;
          if (e.action.medias.length !== 0 ||
              _getVideoLinks(str).length !== 0 ||
              e.action.type === 'instagram') {
            items.push(e);
          }
        });
        feed.events.items = items;
      }

      // Some magic here... send back the startdate and endate query instead
      // of Date objects, since those will be converted to text by JSON transport
      var query = (feed.events.query.action || {}).query;
      if (query && query.date) {
        if (query.date.$gte) {
          query.startdate = query.date.$gte;
          delete query.date.$gte;
        }
        if (query.date.$lte) {
          query.enddate = query.date.$lte;
          delete query.date.$lte;
        }
      }
      res.send(iutil.client({events: feed.events}));
    });
  });

  return exports;
};
