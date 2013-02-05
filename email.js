// Handling for, wait for it ... email!


/**
 * Module dependencies.
 */

var mailer = require('emailjs');
var path = require('path');
var jade = require('jade');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');

var SMTP;
var server = {
  user: 'robot@island.io',
  password: 'I514nDr06ot',
  host: 'smtp.gmail.com',
  ssl: true,
};
var defaults = {
  from: 'Island <robot@island.io>',
};
var HOME_URI;
exports.setHomeURI = function (uri) {
  HOME_URI = uri;
}

/**
 * Send an email.
 * @param object options
 * @param object template
 * @param function fn
 */
var send = exports.send = function (options, template, fn) {
  if ('function' === typeof template) {
    fn = template;
    template = false;
  }

  // connect to server
  if (!SMTP)
    SMTP = mailer.server.connect(server);

  // merge options
  _.defaults(options, defaults);

  if (template)
    jade.renderFile(path.join(__dirname, 'views', template.file),
        template.locals, function (err, body) {
      if (err) return fn ? fn(): null;
      // create the message
      var message;
      if (template.html) {
        message = mailer.message.create(options);
        message.attach_alternative(body);
      } else message = options;
      message.text = body;
      // send email
      SMTP.send(message, fn);
    });
  else
    // send email
    SMTP.send(options, fn);
};

/**
 * Send the welcome message.
 * @param object user
 */
var welcome = exports.welcome = function (member, confirm, fn) {
  if (!HOME_URI) return fn ? fn(): null;
  var to = member.displayName + ' <' + member.primaryEmail + '>';
  send({
    to: to,
    subject: '[Island] Welcome to our home.'
  }, {
    file: 'welcome.jade',
    html: true,
    locals: { member: member, confirm: confirm }
  }, fn);
}

/**
 * Send a notification.
 * @param object user
 */
var notification = exports.notification = function (member, note, fn) {
  if (!HOME_URI) return fn ? fn(): null;
  var to = member.displayName + ' <' + member.primaryEmail + '>';
  var subject = note.member_id.toString() === note.event.poster_id.toString() ?
             '[Island] Your post, ' + note.event.data.p:
             '[Island] ' + note.event.data.p + ' from ' + note.event.data.o;
  send({
    to: to,
    from: note.event.data.m + ' <robot@island.io>',
    'reply-to': 'notifications+' + note.member_id.toString() + note.event.post_id.toString() + '@island.io',
    subject: subject
  }, {
    file: 'notification.jade',
    html: true,
    locals: {
      note: note,
      link: HOME_URI + '/' + note.event.data.k,
      sets_link: HOME_URI + '/settings/' + member.key
    }
  }, fn);
}

/**
 * Send the error to Sander.
 * @param object err
 */
var problem = exports.problem = function (err) {
  if (!HOME_URI) return;
  send({
    to: 'Island Admin <sander@island.io>',
    subject: 'Something wrong at Island'
  }, {
    file: 'problem.jade',
    html: false,
    locals: { err: err }
  }, function () {});
}
