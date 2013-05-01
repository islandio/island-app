/*
 * service.js: Page service.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');

// Prepare resources.
exports.routes = function (app) {

  // Member profile
  app.post('/service/member.profile', function (req, res) {
    var profile = {member: req.session.user, content: {}};
    Step(
      function () {
        db.Members.read({username: req.body.username}, this);
      },
      function (err, member) {
        profile.content.page = member;
        db.Comments.find({member_id: member._id}).toArray(this);
      },
      function (err, comments) {
        profile.content.comments = {items: comments};
        res.send(profile);
      }
    );
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
  
}