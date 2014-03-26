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
    twitterId: 1
  },
  post: {
    collection: 'post',
    key: 1,
    title: 1,
    vcnt: 1,
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
