/*
 * store.js: Handles orders from the store.
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

exports.init = function () {
  return this.routes();
};

exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var emailer = app.get('emailer');
  var sendowl = app.get('sendowl');
  var shipwire = app.get('shipwire');

  // Create
  app.post('/api/store/orders', function (req, res) {
    console.log(req.body, '.....')

    // check inventory...
    // charge card
    // create shipping order

    shipwire.stock.get(function (err, data) {
      if (errorHandler(err, req, res)) return;
      console.log(data)
      res.send();
    });
  });

  // Read
  app.get('/api/store/orders/:id', function (req, res) {
    shipwire.orders.get(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  // Update
  app.put('/api/store/orders/:id', function (req, res) {
    shipwire.orders.update(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  // Delete
  app.delete('/api/store/orders/:id', function (req, res) {
    shipwire.orders.cancel(req.body, function (err, order) {
      if (errorHandler(err, req, res)) return;
      res.send();
    });
  });

  return exports;
};
