/*
 * mail.js: Mail handling.
 *
 */

// Module Dependencies
var mailer = require('emailjs');
var jade = require('jade');
var path = require('path');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

/**
 * Constructor.
 * @object options
 */
module.exports = function (options) {
  this.options = options;
  this.smtp = mailer.server.connect(options.server);
}

/**
 * Send an email.
 * @object options
 * @object template
 * @function cb
 */
module.exports.prototype.send = function (options, template, cb) {
  if ('function' === typeof template) {
    cb = template;
    template = false;
  }
  if (!this.smtp) return util.error('no SMTP server connection')

  // merge options
  _.defaults(options, this.options.defaults);

  if (template)
    jade.renderFile(path.join(__dirname, 'views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb ? cb(): null;

      // create the message
      var message;
      if (template.html) {
        message = mailer.message.create(options);
        message.attach_alternative(body);
      } else message = options;
      message.text = body;

      // send email
      this.smtp.send(message, cb);
    }, this));
  else
    // send email
    this.smtp.send(options, cb);
};

/**
 * Send the welcome message.
 * @object member
 * @string confirm
 * @function cb
 */
module.exports.prototype.welcome = function (member, confirm, cb) {
  var to = member.displayName + ' <' + member.primaryEmail + '>';
  this.send({
    to: to,
    subject: '[Island] Welcome to our home.'
  }, {
    file: 'welcome.jade',
    html: true,
    locals: {member: member, confirm: confirm}
  }, cb);
}

/**
 * Send a notification.
 * @object member
 * @string note
 * @function cb
 */
module.exports.prototype.notification = function (member, note, cb) {
  if (!this.options.BASE_URI) return cb ? cb('BASE_URI required'): null;
  var to = member.displayName + ' <' + member.primaryEmail + '>';
  var subject = note.member_id.toString() === note.event.poster_id.toString() ?
             '[Island] Your post, ' + note.event.data.p:
             '[Island] ' + note.event.data.p + ' from ' + note.event.data.o;
  this.send({
    to: to,
    from: note.event.data.m + ' <robot@island.io>',
    'reply-to': 'notifications+' + note.member_id.toString()
        + note.event.post_id.toString() + '@island.io',
    subject: subject
  }, {
    file: 'notification.jade',
    html: true,
    locals: {
      note: note,
      link: this.options.BASE_URI + '/' + note.event.data.k,
      sets_link: this.options.BASE_URI + '/settings/' + member.key
    }
  }, cb);
}
