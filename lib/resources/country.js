/*
 * country.js: Handling for the country resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
var app = require('../../app');

/* e.g.,
{
  "_id": <ObjectId>,
  "key": <String>,
  "name": <String>,
  "bcnt": <Number>,
  "rcnt": <Number>,
  "bgrdu": <String>, // remove
  "bgrdl": <String>, // remove
  "rgrdu": <String>, // remove
  "rgrdl": <String>, // remove
  "created": <ISODate>
}
*/

// Do any initializations
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  return exports;
}
