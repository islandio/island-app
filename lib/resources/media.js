/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Members = require('../db.js').Members;
var Medias = require('../db.js').Medias;

/* e.g.,
{
  "_id" : ObjectId("4fa5faa88978bf6865000007"),
  "key": <String>,
  "type": <String>,
  "image": <Object>,
  "thumbs": [<Object>],
  "author_id": <ObjectId>,
  "parent_id": <ObjectId>,
  "created": <ISODate>,
  "updated": <ISODate>
}
*/

// Define routes.
exports.routes = function (app) {
  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
