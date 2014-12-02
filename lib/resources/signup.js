/*
 * signup.js: Handles post for beta signup invites
 *
 */

// Module Dependencies
var util = require('util');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "email": <String>,
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

  app.post('/api/signups', function (req, res) {
    var props = req.body;
    db.Signups.create(props, function (err, doc) {
      if (err && err.code === 11000) {
        return res.send(403, {error: {message: 'Exists'}});
      }
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  return exports;
}

