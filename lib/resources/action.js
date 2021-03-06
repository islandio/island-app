/*
 * action.js: Handling for the action resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('@islandio/util');
var Step = require('step');
var _ = require('underscore');
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "index": <Number>,
    "type": <Number>, (0 - N)
    "env": <Number>, (0 / 1)
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
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  return exports;
}
