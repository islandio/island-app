/*
 * mail.js: Handling for the mail resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

/* e.g.,
  {
    body: <String>,
    subject: <String>,
    created : <ISODate>,
    _id: <ObjectID>,
    user_id: <ObjectID>,
    team_id: <ObjectID>
  }
*/

// Define routes.
exports.routes = function (app) {}

// Scheduled tasks.
exports.jobs = function (cb) {}