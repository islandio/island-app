/*
* crag.js: Handling for the crag resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db.js');
var com = require('../common.js');

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "name": <String>,
    "city": <String>,
    "country": <String>,
    "bcnt": <Number>,
    "rcnt": <Number>,
    "bgrdu": <String>,
    "bgrdl": <String>,
    "rgrdu": <String>,
    "rgrdl": <String>,
    "lat": <Number>,
    "lon": <Number>,
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

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
