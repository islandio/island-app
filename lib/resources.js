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
var collections = {
  member: {
    resource: true,
    indexes: [{primaryEmail: 1}, {username: 1}, {key: 1}, {role: 1}],
    uniques: [true, true, true, false]
  },
  post: {
    resource: true,
    indexes: [{key: 1}, {member_id: 1}],
    uniques: [true, false]
  },
  media: {
    indexes: [{type: 1}, {member_id: 1}, {post_id: 1}],
    uniques: [false, false, false]
  },
  comment: {
    resource: true,
    indexes: [{member_id: 1}, {post_id: 1}],
    uniques: [false, false]
  },
  view: {
    indexes: [{member_id: 1}, {post_id: 1}],
    uniques: [false, false]
  },
  hit: {
    indexes: [{member_id: 1}, {media_id: 1}],
    uniques: [false, false]
  },
  rating: {
    indexes: [{member_id: 1}, {media_id: 1}],
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
    indexes: [{member_id: 1}, {post_id: 1}, {mute: 1}],
    uniques: [false, false, false]
  },
  event: {
    indexes: [{member_id: 1}],
    uniques: [false, false]
  },
  notification: {
    indexes: [{member_id: 1}, {read: 1}],
    uniques: [false, false]
  },
};

// Resource profiles for client objects.
exports.profiles = {
  member: {
    username: 1,
    displayName: 1,
    gravatar: function (d) {
      return crypto.createHash('md5').update(d.primaryEmail).digest('hex');
    }
  },
  post: {
    key: 1,
    title: 1
  },
};

// Prepare resources.
exports.init = function (app) {

  // Add resource collections, routes, and jobs.
  _.each(collections, function (conf, name) {
    app.get('db').add(name, conf, function (err) {
      if (conf.resource)
        require('./resources/' + name).routes(app).jobs(app);
    });
  });

}