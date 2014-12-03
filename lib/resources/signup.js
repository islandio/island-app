/*
 * signup.js: Handles post for beta signup invites
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
  var emailer = app.get('emailer');

  app.post('/api/signups', function (req, res) {
    var props = req.body;
    db.Members.findOne({primaryEmail: props.email}, function (err, mem) {
      if (mem)
        return res.send(403, {error: {message: 'Member'}});
      db.Signups.create(props, function (err, doc) {
        if (err && err.code === 11000) {
          return res.send(403, {error: {message: 'Exists'}});
        }
        if (errorHandler(err, req, res)) return;
        res.send();
      });
    });
  });

  // update
  app.put('/api/signups', function (req, res) {
    if (!req.user || !req.user.admin)
      return res.send(403, {error: {message: 'Not admin'}});

    var props = req.body;
    Step(
      function() {
        db.Signups.read({email: req.body.email}, this);
      },
      function (err, signup) {
        if (err) return this(err);
        var newProps = {invited: new Date(), email: req.body.email};
        if (!signup) db.Signups.create(newProps, this);
        else if (signup.invited) {
          return this();
        }
        else {
          db.Signups.update({email: req.body.email}, {$set: newProps}, this);
        }
      },
      function (err) {
        if (err) return this(err);
        emailer.send({
          to: req.body.email,
          from: 'Island Beta <admin@island.io>',
          subject: 'Island Beta',
          text: 'Welcome to Island Beta! Signup at http://island.io/signup'
        }, this)
      },
      function (err, msg) {
        if (errorHandler(err, req, res)) return;
        res.send();
      }
    );
  });

  return exports;
}

