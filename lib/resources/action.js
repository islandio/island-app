/*
 * action.js: Handling for the action resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
  {
    "_id": <ObjectId>,
    "index": <Number>,
    "type": <Number>, (0 - N)
    "env": <Number>, (0 / 1)
    "duration": <Number>,
    "performance": <Number>, (-1 - 1)
    "date": <ISODate>,
    "author_id": <ObjectId>,
    "country_id": <ObjectId>,
    "crag_id": <ObjectId>,
    "session_id": <ObjectId>,
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
  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
