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

// Defaults
var FROM = 'Island <robot@island.io>';

/**
 * Constructor.
 * @object options
 */
module.exports = function (options, uri) {
  this.options = options;
  this.BASE_URI = uri;  
  this.smtp = mailer.server.connect(options);
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

  if (template)
    jade.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb();

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
 * Send a notification.
 * @object subscriber
 * @string note
 * @function cb
 */
module.exports.prototype.notify = function (subscriber, note, body, cb) {
  cb = cb || function(){};
  if (!this.BASE_URI) return cb('BASE_URI required');

  // Build the email subject.
  var subject;
  var owner;
  var preverb = '';
  if (note.event.data.action.i === note.event.data.target.i) {
    owner = 'their';
    preverb = 'also ';
  } else if (note.subscriber_id.toString() === note.event.data.target.i)
    owner = 'your';
  else {
    owner = note.event.data.target.a + '\'s';
    preverb = 'also ';
  }
  if (note.event.data.action.t === 'comment') {
    var verb = preverb + 'commented on';
    subject = note.event.data.action.a + ' '
        + verb + ' '
        + owner + ' '
        + note.event.data.target.t
        + (note.event.data.target.n !== '' ? ' "'
        + note.event.data.target.n + '"': '');
  } else subject = '';

  // Setup the email.
  this.send({
    to: subscriber.displayName + ' <' + subscriber.primaryEmail + '>',
    from: note.event.data.action.a + ' <robot@island.io>',
    // 'reply-to': 'notifications+' + subscriber._id.toString()
    //     + note.event.post_id.toString() + '@island.io',
    subject: subject
  }, {
    file: 'notification.jade',
    html: true,
    locals: {
      body: body || '',
      url: this.BASE_URI + '/' + note.event.data.target.s,
      surl: this.BASE_URI + '/settings'
    }
  }, cb);
}
