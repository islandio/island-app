/*
 * signup.js: Handles post for beta signup invites
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var _ = require('underscore');
var profiles = require('island-collections').profiles;
var app = require('../../app');
var Step = require('step');

/* e.g.,
  {
    "_id": <ObjectId>,
    "member_id": <ObjectId>,
    "code": <String>,
    "email": <String>,
    "invited": <ISODate>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

// Do any initializations
exports.init = function () {
  return this.routes();
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var emailer = app.get('emailer');

  // Request invite
  app.post('/api/signups', function (req, res) {
    if (!req.body.email) {
      return res.status(403).send({error: {message: 'Invalid signup'}});
    }
    var props = req.body;

    db.Members.read({primaryEmail: props.email}, function (err, mem) {
      if (errorHandler(err, req, res)) return;
      if (mem && mem.invited) {
        return res.status(403).send({error: {message: 'Invited'}});
      }
      props.code = iutil.code();
      db.Signups.create(props, function (err, doc) {
        if (err && err.code === 11000) {
          return res.status(403).send({error: {message: 'Exists'}});
        }
        if (errorHandler(err, req, res)) return;
        res.send();
      });
    });
  });

  // Do invite
  app.put('/api/signups', function (req, res) {
    if (!req.user || !req.user.admin) {
      return res.status(403).send({error: {message: 'Not admin'}});
    }
    if (!req.body.email) {
      return res.status(403).send({error: {message: 'Invalid signup'}});
    }
    var props = req.body;

    db.Signups.read({email: props.email}, function (err, signup) {
      if (err) return cb(err);
      var memQuery = {};
      if (signup && signup.member_id) {
        memQuery._id = signup.member_id;
      } else {
        memQuery.primaryEmail = props.email;
      }
      db.Members.read(memQuery, function (err, mem) {
        if (err) return cb(err);
        var invited = new Date;

        Step(
          function () {

            // Update the signup.
            if (signup) {
              var update = {invited: invited};
              if (mem) {
                update.member_id = mem._id;
              }
              db.Signups.update({_id: signup._id}, {$set: update}, this);
            } else {
              props.code = iutil.code();
              props.invited = invited;
              if (mem) {
                props.member_id = mem._id;
              }
              db.Signups.create(props, this);
            }
          },
          function (err) {
            if (err) return this(err);
            if (!mem) {
              return this();
            }

            // Update the member.
            db.Members.update({_id: mem._id}, {$set: {invited: invited}}, this);
          },
          function (err) {
            if (err) return this(err);

            // Send the email.
            var email = {
              to: signup.email,
              from: 'Island <robot@island.io>',
              subject: 'You are invited to The (new) Island.'
            };
            if (mem) {
              email.text = 'Welcome back to The (new) Island!'
                  + ' You may sign in again at ' + app.get('HOME_URI')
                  + '/signin?ic=' + signup.code;
            } else {
              email.text = 'Welcome to The (new) Island!'
                  + ' You may sign up for an athlete account at '
                  + app.get('HOME_URI') + '/signup?ic=' + signup.code;
            }
            emailer.send(email, this);
          },
          function (err) {
            if (errorHandler(err, req, res)) return;
            res.send();
          }
        );
      });
    });
  });

  return exports;
}
