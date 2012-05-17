
/**
 * Module dependencies.
 */
var mailer = require('emailjs');
var path = require('path');
var jade = require('jade');

var SMTP;

var emailServer = {
  user: 'robot@island.io',
  password: 'I514nDr06ot',
  host: 'smtp.gmail.com',
  ssl: true,
};
var emailDefaults = {
  from: 'Island <robot@island.io>',
};

/**
 * Send an email.
 * @param object options
 * @param object template
 * @param function fn
 */
var email = exports.email = function (options, template, fn) {
  if ('function' === typeof template) {
    fn = template;
    template = false;
  }

  // connect to server
  if (!SMTP)
    SMTP = mailer.server.connect(emailServer);

  // merge options
  var k = Object.keys(emailDefaults);
  for (var i=0; i < k.length; i++)
    if (!options.hasOwnProperty(k[i]))
      options[k[i]] = emailDefaults[k[i]];

  if (template)
    jade.renderFile(path.join(__dirname, 'views', template.file),
        template.locals, function (err, body) {
      if (err) return fn(err);
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
  var to = member.displayName + '<' + member.primaryEmail + '>';
  email({
    to: to,
    subject: 'Please activate your new account'
  }, {
    file: 'welcome.jade',
    html: true,
    locals: { member: member, confirm: confirm }
  }, fn);
}

/**
 * Send the error to Sander.
 * @param object err
 */
var problem = exports.problem = function (err) {
  email({
    to: 'Island Admin <sander@island.io>',
    subject: 'Something wrong at Island'
  }, {
    file: 'problem.jade',
    html: false,
    locals: { err: err }
  }, function () {});
}

