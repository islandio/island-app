/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
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

  // Delete
  app.delete('/api/medias/:id', function (req, res) {
    if (!req.user) {
      return res.status(403).send({error: 'Member invalid'});
    }

    db.Medias.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'media')) return;
      if (req.user._id.toString() !== doc.author_id.toString()) {
        return res.status(403).send({error: 'Member invalid'});
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
