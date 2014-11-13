/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var request = require('request');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
{
  "_id" : <ObjectId>,
  "key": <String>,
  "type": <String>,
  "image": <Object>,
  "thumbs": [<Object>],
  "location": {
    "latitude": <Number>,
    "longitude": <Number>
  },
  "author_id": <ObjectId>,
  "parent_id": <ObjectId>,
  "ascent_id": <ObjectId>,
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
  var cache = app.get('cache');

  // List
  app.post('/api/medias/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);
    if (query.parent_id) query.parent_id = db.oid(query.parent_id);

    db.Medias.list(query, {sort: {created: -1}, limit: limit, inc: true,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, medias) {
      if (com.error(err, req, res)) return;

      Step(
        function () {

          // Fill medias.
          db.fill(medias, 'Comments', 'parent_id', {sort: {created: -1},
              limit: 5, reverse: true, inflate: {author: profiles.member}},
              this.parallel());
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({
            medias: {
              cursor: ++cursor,
              more: medias && medias.length === limit,
              items: medias,
              query: query,
            }
          }));
        }
      );
    });

  });

  // Delete
  app.delete('/api/medias/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the media.
    db.Medias.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'media')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: 'Member invalid'});
      }

      Step(
        function () {

          // Remove the doc.
          db.Medias.remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('media', 'media.removed', {data: {id: doc._id.toString()}});

          res.send({removed: true});
        }
      );
    });
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
