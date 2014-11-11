/*
 * events.js: Handling for the event resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var authorize = require('./member').authorize;
var com = require('../common');
var profiles = require('../resources').profiles;

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
    "date": <ISODate>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }

*/

// Do any initializations
exports.init = function (app) {
  return exports;
};

// Build feed for member.
exports.feed = function (query, actions, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  var cursor = options.cursor || 0;
  delete options.cursor;
  options.limit = options.limit || 5;
  options.skip = cursor * options.limit;
  options.sort = {date: -1, created: -1};

  // Handle query.
  if (query.action) {
    _getEventsByAction(_.capitalize(query.action.type) + 's',
        query.action.query, _finish);
  } else {
    if (query.subscribee_id) {
      _getEventsBySubscription([query.subscribee_id], _finish);
    } else if (query.subscriber_id) {
      db.Subscriptions.list({$or: [
        {subscriber_id: query.subscriber_id, mute: false, 'meta.style': 'follow'},
        {subscriber_id: query.subscriber_id, mute: false, 'meta.style': 'watch'}
      ]}, function (err, subs) {
        if (err) return cb(err);

        // Consolidate subscribees.
        var subscribees = _.pluck(subs, 'subscribee_id');
        subscribees.push(query.subscriber_id);
        _getEventsBySubscription(subscribees, _finish);
      });
    } else cb(null, []);
  }

  function _finish(err, events) {
    if (err) return cb(err);
    cb(null, {
      cursor: ++cursor,
      more: events && events.length === options.limit,
      limit: options.limit,
      actions: actions,
      query: query,
      items: events || []
    });
  }

  // Get event by first finding actions by query.
  function _getEventsByAction(type, query, cb) {
    db[type].list(query, options, function (err, docs) {
      if (err) return cb(err);
      if (docs.length === 0) return cb();

      // Prepare events.
      var events = [];
      var _cb = _.after(docs.length, function (err) { cb(err, events); });
      _.each(docs, function (d) {

        // Get action's event.
        db.Events.read({action_id: d._id}, function (err, e) {

          if (err) return this(err);

          // Collect event.
          e.action = d;
          events.push(e);
          _prepareEventAction(e, _cb);
        });
      });
    });
  }

  // Get events related to subscriptions.
  function _getEventsBySubscription(subscribees, cb) {
    db.Events.list({
      action_type: {$in: actions},
      $or: [
        {actor_id: {$in: subscribees}},
        {target_id: {$in: subscribees}}
      ]
    }, options, function (err, events) {
      if (err) return cb(err);
      if (events.length === 0) return cb();
      // events = _sortEvents(events);

      // Prepare events.
      var _cb = _.after(events.length, function (err) { cb(err, events); });
      _.each(events, function (e) {

        // Inflate event action.
        db.inflate(e, {action: {collection: e.action_type, '*': 1}},
            function (err) {
          if (err) return _cb(err);

          // Prepare event.
          _prepareEventAction(e, _cb);
        });
      });
    });
  }

  // Sort events by 'created'.
  // (they are queried by 'date' but may not be in correct order within each day)
  function _sortEvents(events) {
    console.log(events.length)
    var dates = _.groupBy(events, function (e) {
      var date = new Date(e.date);
      var year = date.getFullYear().toString();
      var date = date.getDate().toString();
      if (date.length === 1) {
        date = '0' + date;
      }
      return year + date;
    });
    dates = _.map(dates, function (d) {
      return d.sort(function (a, b) {
        return new Date(b.created) - new Date(a.created);
      });
    });
    dates = dates.sort(function (a, b) {
      return new Date(b[0].date) - new Date(a[0].date);
    });
    return _.flatten(dates, true);
  }

  // Inflate and fill an action.
  function _prepareEventAction(e, cb) {
    Step (
      function () {
        switch (e.action_type) {

          case 'post':
            db.inflate(e.action, {author: profiles.member}, this.parallel());
            db.fill(e.action, 'Medias', 'parent_id', {sort: {created: -1},
                limit: 50}, this.parallel());
            db.fill(e.action, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, reverse: true, inflate: {author: profiles.member}},
                this.parallel());
            db.fill(e.action, 'Hangtens', 'parent_id', this.parallel());
            break;

          case 'comment':
            db.inflate(e.action, {author: profiles.member,
                parent: profiles[e.data.target.t]}, this);
            break;

          case 'session':
            Step(
              function () {
                db.inflate(e.action, {author: profiles.member,
                    crag: profiles.crag}, this.parallel());
                db.fill(e.action, 'Actions', 'session_id', {sort: {index: 1}},
                    this.parallel());
              },
              function (err) {
                if (err) return this(err);
                db.fill(e.action.actions, 'Ticks', 'action_id', {sort: {index: 1},
                    inflate: {author: profiles.member,
                    ascent: profiles.ascent}}, this);
              },
              function (err) {
                if (err) return this(err);
                _.each(e.action.actions, _.bind(function (a) {
                  db.fill(a.ticks, 'Comments', 'parent_id', {sort: {created: -1},
                      limit: 5, reverse: true, inflate: {author: profiles.member}},
                      this.parallel());
                  db.fill(a.ticks, 'Hangtens', 'parent_id', this.parallel());
                  db.fill(a.ticks, 'Medias', 'parent_id', {sort: {created: -1}},
                      this.parallel());
                }, this));
              }, this
            );
            break;

          case 'tick':
            db.inflate(e.action, {author: profiles.member,
                ascent: profiles.ascent, crag: profiles.crag}, this.parallel());
            db.fill(e.action, 'Comments', 'parent_id', {sort: {created: -1},
                limit: 5, reverse: true, inflate: {author: profiles.member}},
                this.parallel());
            db.fill(e.action, 'Hangtens', 'parent_id', this.parallel());
            db.fill(e.action, 'Medias', 'parent_id', this.parallel());
            break;

          case 'crag':
            db.inflate(e.action, {author: profiles.member}, this.parallel());
            db.fill(e.action, 'Hangtens', 'parent_id', this.parallel());
            break;

          case 'ascent':
            db.inflate(e.action, {author: profiles.member,
                crag: profiles.crag}, this.parallel());
            db.fill(e.action, 'Hangtens', 'parent_id', this.parallel());
            break;
        }
      },
      function (err) {
        cb(err);
      }
    );
  }

};

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');

  // List
  app.post('/api/events/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var query = req.body.query || {};
    var actions = req.body.actions || ['session', 'post', 'crag', 'ascent'];
    if (typeof query.subscribee_id === 'string') {
      query.subscribee_id = db.oid(query.subscribee_id);
    }
    if (typeof query.subscriber_id === 'string') {
      query.subscriber_id = db.oid(query.subscriber_id);
    }

    exports.feed(query, actions, {limit: limit, cursor: cursor, query: query},
        function (err, events) {
      if (com.error(err, req, res)) return;

      // Send profile.
      res.send(com.client({events: events}));
    });
  });

  return exports;
};

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
};
