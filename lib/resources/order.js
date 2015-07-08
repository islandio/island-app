/*
 * order.js: Handles orders from the store.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');
var Step = require('step');
var Shipwire = require('island-shipwire');

/* e.g.,
  {
    "_id": <ObjectId>,
    "member_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

exports.init = function () {
  return this.routes();
};

exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var emailer = app.get('emailer');

  // Create
  app.post('/api/store/orders', function (req, res) {
    Shipwire.createOrder(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  // Read
  app.get('/api/store/orders/:id', function (req, res) {
    Shipwire.getOrder(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  // Update
  app.put('/api/store/orders/:id', function (req, res) {
    Shipwire.updateOrder(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  // Delete
  app.delete('/api/store/orders/:id', function (req, res) {
    Shipwire.deleteOrder(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  return exports;
};
