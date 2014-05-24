/*
 * mail.js: Mail handling.
 *
 */

// Module Dependencies
var mailer = require('emailjstmp');
var jade = require('jade');
var path = require('path');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');

/**
 * Constructor.
 * @object options
 */
module.exports = function (options, uri) {
  this.FROM = options.from;
  delete options.from;
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
  if (!this.smtp) return util.error('no SMTP server connection');

  if (template)
    jade.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb(err);

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
 * @object recipient
 * @object note
 * @string body
 * @function cb
 */
module.exports.prototype.notify = function (recipient, note, body, cb) {
  cb = cb || function(){};
  return cb();
  if (!this.BASE_URI) return cb('BASE_URI required');

  // Build the email subject.
  var subject;
  if (note.event.data.action.t === 'comment') {
    var verb = 'commented on';
    var owner;

    // TMP
    if (note.event.data.target.c === 'ascent') {
      if (note.event.data.action.i === note.event.data.target.i) {
        verb = 'also ' + verb;
        owner = 'they added';
      } else if (note.subscriber_id.toString() === note.event.data.target.i)
        owner = 'you added';
      else {
        owner = '';
        verb = 'also ' + verb;
      }
      subject = note.event.data.action.a + ' '
          + verb + ' a '
          + note.event.data.target.p + ' '
          + owner + ' of '
          + note.event.data.target.n + ' at '
          + note.event.data.target.w;

    } else if (!note.event.data.target.c) {
      if (note.event.data.action.i === note.event.data.target.i) {
        owner = 'their';
        verb = 'also ' + verb;
      } else if (note.subscriber_id.toString() === note.event.data.target.i)
        owner = 'your';
      else {
        owner = note.event.data.target.a + '\'s';
        verb = 'also ' + verb;
      }
      subject = note.event.data.action.a + ' '
          + verb + ' '
          + owner + ' '
          + note.event.data.target.t
          + (note.event.data.target.n !== '' ? ' "'
          + note.event.data.target.n + '"': '');
    }
  } else if (note.event.data.action.t === 'hangten') {
    subject = note.event.data.action.a + ' '
        + 'thinks your '
        + note.event.data.target.t
        + (note.event.data.target.n !== '' ? ' '
        + note.event.data.target.n + '': '')
        + ' is hang ten';
  } else if (note.event.data.action.t === 'request') {
    subject = note.event.data.action.a + ' '
        + 'wants to follow you';
  } else if (note.event.data.action.t === 'accept') {
    subject = 'You are now following '
        + note.event.data.action.a;
  } else if (note.event.data.action.t === 'follow') {
    subject = note.event.data.action.a + ' '
        + 'is now following you';

  // TMP
  } else if (note.event.data.action.t === 'media') {
    var verb = 'also added';

    subject = note.event.data.action.a + ' '
        + verb + ' a '
        + note.event.data.action.b + ' of '
        + note.event.data.target.n + ' at '
        + note.event.data.target.w;
  }
  if (!subject) return cb('Invalid email subject');

  // Determine what the email should link to.
  var url = this.BASE_URI;
  if (note.event.data.action.t === 'request'
      || note.event.data.action.t === 'accept'
      || note.event.data.action.t === 'follow')
    url += '/' + note.event.data.action.s;
  else
    url += '/' + note.event.data.target.s

  // Create a login key for this email.
  db.Keys.create({member_id: recipient._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: recipient.displayName + ' <' + recipient.primaryEmail + '>',
      from: this.FROM,
      // 'reply-to': 'notifications+' + recipient._id.toString()
      //     + note.event.post_id.toString() + '@island.io',
      subject: subject
    }, {
      file: 'notification.jade',
      html: true,
      locals: {
        body: body || '',
        url: url,
        surl: this.BASE_URI + '/settings/' + key._id.toString()
      }
    }, cb);
  }, this));
}

/**
 * Send a password reset key.
 * @object member
 * @function cb
 */
module.exports.prototype.reset = function (member, cb) {
  cb = cb || function(){};
  if (!this.BASE_URI) return cb('BASE_URI required');

  // Create a login key for this email.
  db.Keys.create({member_id: member._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: member.displayName + ' <' + member.primaryEmail + '>',
      from: this.FROM,
      subject: 'Island Password Reset'
    }, {
      file: 'reset.jade',
      html: true,
      locals: {
        name: member.displayName.trim(),
        url: this.BASE_URI + '/reset?t=' + key._id.toString()
      }
    }, cb);
  }, this));
}
