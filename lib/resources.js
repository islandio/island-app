/*
 * resources.js: Handling for resource routing.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var com = require('./common');

// Resource collections.
exports.collections = {
  member: {
    resource: true,
    indexes: [{primaryEmail: 1}, {username: 1}, {role: 1}],
    uniques: [true, true, false],
    sparses: [true, false, false]
  },
  post: {
    resource: true,
    indexes: [{key: 1}, {author_id: 1}],
    uniques: [true, false]
  },
  media: {
    resource: true,
    indexes: [{type: 1}, {author_id: 1}, {parent_id: 1}],
    uniques: [false, false, false]
  },
  comment: {
    resource: true,
    indexes: [{author_id: 1}, {parent_id: 1}],
    uniques: [false, false]
  },
  hangten: {
    resource: true,
    indexes: [{author_id: 1, parent_id: 1}],
    uniques: [true]
  },
  country: {
    resource: true,
    indexes: [{key: 1}],
    uniques: [true]
  },
  crag: {
    resource: true,
    indexes: [{key: 1}, {type: 1}, {country_id: 1}],
    uniques: [true, false, false]
  },
  ascent: {
    resource: true,
    indexes: [{key: 1}, {type: 1}, {country_id: 1}, {crag_id: 1}],
    uniques: [true, false, false, false]
  },
  session: {
    resource: true,
    indexes: [{key: 1}, {env: 1}, {author_id: 1}, {country_id: 1}, {crag_id: 1}],
    uniques: [true, false, false, false, false]
  },
  action: {
    resource: true,
    indexes: [{type: 1}, {author_id: 1}, {crag_id: 1}, {session_id: 1}],
    uniques: [false, false, false, false]
  },
  tick: {
    resource: true,
    indexes: [{type: 1}, {sent: 1}, {author_id: 1}, {crag_id: 1}, {ascent_id: 1}],
    uniques: [false, false, false, false, false]
  },
  subscription: {
    indexes: [{subscriber_id: 1, subscribee_id: 1}, {type: 1}],
    uniques: [true, false]
  },
  event: {
    resource: true,
    indexes: [{actor_id: 1}, {target_id: 1}],
    uniques: [false, false]
  },
  notification: {
    resource: true,
    indexes: [{subscriber_id: 1}, {read: 1}],
    uniques: [false, false]
  },
  key: {}
};

// Resource profiles for client objects.
exports.profiles = {
  member: {
    collection: 'member',
    username: 1,
    role: 1,
    displayName: 1,
    gravatar: function (d) {
      return com.hash(d.primaryEmail || 'foo@bar.baz');
    },
    facebookId: 1,
    twitterId: 1,
  },
  post: {
    collection: 'post',
    key: 1,
    type: 1,
    title: 1,
    vcnt: 1,
  },
  media: {
    collection: 'media',
    key: 1,
    type: 1,
    vcnt: 1,
  },
  comment: {
    collection: 'comment',
    body: 1,
  },
  session: {
    collection: 'session',
    env: 1,
    name: 1,
    date: 1,
  },
  action: {
    collection: 'action',
    env: 1,
    type: 1,
    duration: 1,
    performance: 1,
    date: 1,
  },
  tick: {
    collection: 'tick',
    type: 1,
    sent: 1,
    grade: 1,
    feel: 1,
    tries: 1,
    rating: 1,
    date: 1,
    first: 1,
    firstf: 1,
  },
  crag: {
    collection: 'crag',
    key: 1,
    name: 1,
    city: 1,
    country: 1,
    location: 1,
  },
  ascent: {
    collection: 'ascent',
    key: 1,
    name: 1,
    type: 1,
    grades: 1,
    sector: 1,
  },
  event: {
    collection: 'event',
    data: 1,
  },
};

// Prepare resources.
exports.init = function (app, cb) {

  // Add resource collections, routes, and jobs.
  var _cb = _.after(_.size(exports.collections), cb);
  _.each(exports.collections, function (conf, name) {
    (app.settings ? app.get('connection'): app.connection)
        .add(name, conf, function (err) {
      if (err) return _cb(err);
      if (app.settings && conf.resource) {
        var res = require('./resources/' + name);
        res.init(app).routes(app);
        if (app.get('SCHEDULE_JOBS')) res.jobs(app);
      }
      _cb();
    });
  });

}
