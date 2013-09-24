/*
 * country.js: Handling for the country resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');

/* e.g.,
{
  "_id": <ObjectId>,
  "key": <String>,
  "name": <String>,
  "bcnt": <Number>,
  "rcnt": <Number>,
  "bgrdu": <String>,
  "bgrdl": <String>,
  "rgrdu": <String>,
  "rgrdl": <String>,
  "created": <ISODate>
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
