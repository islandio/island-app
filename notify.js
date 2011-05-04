var mailer = require('emailjs')
  , crypto = require('crypto')
  , path = require('path')
  , sys = require('sys')
  , jade = require('jade')
  , SMTP
;



var emailServer = {
        user     : 'robot@island.io'
      , password : 'I514nDr06ot'
      , host     : 'smtp.gmail.com'
      , ssl      : true
    }
  , emailDefaults = {
       from      : 'Island <robot@island.io>'
    }
    
    
  /**
   * send mail
   * @param object options
   * @param object template
   * @param function fn
   */
   
  , email = function (options, template, fn) {
      if ('function' == typeof template) {
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
        jade.renderFile(path.join(__dirname, 'views', template.file), { locals: template.locals }, function (err, body) {
          if (err) {
            console.log(err);
            return;
          }
          // create the message
          if (template.html) {
            var message = mailer.message.create(options);
            message.attach_alternative(body);
          } else
            var message = options;
          message.text = body;
          // send email
          SMTP.send(message, fn);
        });
      else
        // send email
        SMTP.send(options, fn);
    }
    
  /**
   * Send the welcome message
   * @param object user
   */
  
  , welcome = function (member, confirm, fn) {
      var to = member.name.first + ' ' + member.name.last + '<' + member.email + '>';
      email({ to: to, subject: 'Please activate your new account' }, { file: 'welcome.jade', html: true, locals: { member: member, confirm: confirm } }, fn);
    }
    
  /**
   * Send the error to Sander
   * @param object err
   */
  
  , problem = function (err) {
      email({ to: 'Island Admin <sander@island.io>', subject: 'Something wrong at Island' }, { file: 'problem.jade', html: false, locals: { err: err } }, function () {});
    }
;
  


exports.email = email;
exports.welcome = welcome;
exports.problem = problem;


