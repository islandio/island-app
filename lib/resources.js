/*
 * resources.js: Handling for resource routing.
 *
 */

// Module Dependencies
var util = require('util');
var crypto = require('crypto');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

// Resource collections.
exports.collections = {
  member: {
    resource: true,
    indexes: [{primaryEmail: 1}, {username: 1}, {role: 1}],
    uniques: [true, true, false]
  },
  post: {
    resource: true,
    indexes: [{key: 1}, {author_id: 1}],
    uniques: [true, false]
  },
  media: {
    indexes: [{type: 1}, {author_id: 1}, {parent_id: 1}],
    uniques: [false, false, false]
  },
  comment: {
    resource: true,
    indexes: [{author_id: 1}, {parent_id: 1}],
    uniques: [false, false]
  },
  view: {
    indexes: [{author_id: 1}, {parent_id: 1}],
    uniques: [false, false]
  },
  hit: {
    indexes: [{author_id: 1}, {media_id: 1}],
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
    indexes: [{subscriber_id: 1}, {subscribee_id: 1}, {type: 1}],
    uniques: [false, false, false]
  },
  event: {
    indexes: [{actor_id: 1}, {target_id: 1}],
    uniques: [false, false]
  },
  notification: {
    resource: true,
    indexes: [{member_id: 1}, {read: 1}],
    uniques: [false, false]
  },
};

// Resource profiles for client objects.
exports.profiles = {
  member: {
    collection: 'member',
    username: 1,
    role: 1,
    displayName: 1,
    gravatar: function (d) {
      return crypto.createHash('md5').update(d.primaryEmail).digest('hex');
    }
  },
  post: {
    collection: 'post',
    key: 1,
    title: 1
  },
  event: {
    collection: 'event',
    data: 1,
  },
};

// Prepare resources.
exports.init = function (app) {

  // Add resource collections, routes, and jobs.
  _.each(exports.collections, function (conf, name) {
    app.get('connection').add(name, conf, function (err) {
      if (conf.resource)
        require('./resources/' + name).routes(app).jobs(app);
    });
  });

}
