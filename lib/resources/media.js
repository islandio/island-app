/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var collections = require('island-collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../../app');

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
exports.init = function () {
  return this.routes();
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // List
  app.post('/api/medias/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 20;
    var skip = req.body.skip || cursor * limit;
    var query = {};

    db.Medias.list({parent_id: {$exists: true}, parent_type:
        {$exists: true}, $or: [{type: {$ne: 'video'}}, {quality: 'ipad'}]},
        {sort: {created: -1}, limit: limit, skip: skip, inflate: {author:
        profiles.member}}, function (err, medias) {
      if (errorHandler(err, req, res)) return;

      var _medias = [];
      Step(
        function () {
          if (medias.length === 0) {
            return this();
          }

          var _this = _.after(medias.length, this);
          _.each(medias, function (m) {
            hasAccess(db, req.user, m, function (err, allow) {
              if (err) return _this(err);
              if (allow) {
                db.inflate(m, {parent: profiles[m.parent_type]},
                    function (err) {
                  _medias.push(m);
                });
              }
              _this();
            });
          });
        },
        function (err) {
          if (errorHandler(err, req, res)) return;

          _medias.sort(function (a, b) {
            return new Date(b.created) - new Date(a.created);
          });

          res.send(iutil.client({
            medias: {
              cursor: ++cursor,
              more: medias.length !== 0,
              items: _medias
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

    db.Medias.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'media')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.send(403, {error: 'Member invalid'});
      }

      Step(
        function () {
          db.Medias.remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          if (errorHandler(err, req, res)) return;

          // Publish removed status.
          events.publish('media', 'media.removed',
              {data: {id: doc._id.toString()}});

          res.send({removed: true});
        }
      );
    });
  });

  return exports;
};
