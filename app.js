#!/usr/bin/env node

/**
 * Arguments.
 */
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('port', 'Port to listen on')
      .default('port', 3644)
    .describe('db', 'MongoDb URL to connect to')
      .default('db', 'mongo:///island:27018')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

/**
 * Module dependencies.
 */
var express = require('express');
var connect = require('connect');
var now = require('now');
var mongodb = require('mongodb');
var mongoStore = require('connect-mongodb');

var stylus = require('stylus');
var jade = require('jade');

var util = require('util'), debug = util.debug, inspect = util.inspect;
var fs = require('fs');
var path = require('path');

var _ = require('underscore');
_.mixin(require('underscore.string'));
var Step = require('step');
var color = require('cli-color');

var Notify = require('./notify');

var MemberDb = require('./member_db.js').MemberDb;

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

var transloadit = {
  "auth": { "key": "8a36aa56062f49c79976fa24a74db6cc" },
  "template_id": "dd77fc95cfff48e8bf4af6159fd6b2e7"
};


// Configuration

var app = module.exports = express.createServer();

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  Notify.active = false;
});

app.configure('production', function () {
  app.use(express.errorHandler());
  Notify.active = true;
});

app.set('sessionStore', new mongoStore({
  db: mongodb.connect(argv.db, { noOpen: true }, function () {}),
}, function (err) {
  if (err) log('Error creating mongoStore: ' + err);
}));

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());

  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 * 7 }, // one week
    secret: '69topsecretislandshit69',
    store: app.set('sessionStore'),
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.logger({
    format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms'
  }));

  app.use(express.methodOverride());
  app.use(app.router);
  app.use(stylus.middleware({ src: __dirname + '/public' }));
  app.use(express.static(__dirname + '/public'));
});


// Passport session cruft

passport.serializeUser(function (member, cb) {
  cb(null, member._id.toString());
});

passport.deserializeUser(function (id, cb) {
  memberDb.findMemberById(id, function (err, member) {
    if (!member) member = {};
    cb(err, member);
  });
});


////////////// Web Routes

// Home
app.get('/', loadMember, function (req, res) {
  findMedia(function (media) {
    getTrending(5, function (trends) {
      getRecentComments(10, function (coms) {
        getTwitterNames(function (names) {
          res.render('index', {
              part   : 'media'
            , media  : media
            , coms   : coms
            , trends : trends
            , cm     : req.currentMember
            , names  : names
          });
        });
      });
    });
  });
});

// Landing page
app.get('/login', function (req, res) {
  res.render('login');
});

// Redirect the user to Facebook for authentication.
// When complete, Facebook will redirect the user
// back to the application at /auth/facebook/return.
// ** The passport strategy initialization must
// happen here becuase host needs to be snarfed from req.
app.get('/auth/facebook', function (req, res, next) {
  // Add referer to session so we can use it on return.
  // This way we can preserve query params in links.
  req.session.referer = req.headers.referer;
  var host = req.headers.host.split(':')[0];
  var home = 'http://' + host + ':' + argv.port + '/';
  passport.use(new FacebookStrategy({
      clientID: 203397619757208,
      clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2',
      callbackURL: home + 'auth/facebook/callback',
    },
    function (accessToken, refreshToken, profile, done) {
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      memberDb.findOrCreateMemberFromFacebook(profile, function (err, member) {
        done(err, member);
      });
    }
  ));
  passport.authenticate('facebook', { scope: ['email', 'user_status'] })(req, res, next);
});

// Facebook will redirect the user to this URL
// after authentication. Finish the process by
// verifying the assertion. If valid, the user will be
// logged in. Otherwise, authentication has failed.
app.get('/auth/facebook/callback', function (req, res, next) {
  passport.authenticate('facebook', { successRedirect: req.session.referer || '/',
                                    failureRedirect: req.session.referer || '/' })(req, res, next);
});

// We logout via an ajax request.
app.get('/logout', function (req, res) {
  req.logOut();
  res.redirect('/');
});

// // Confirm page
// app.get('/confirm/:id', function (req, res) {
//   Member.findById(req.params.id, function (err, mem) {
//     if (!err) {
//       mem.confirmed = true;
//       mem.save(function (err) {
//         if (!err) {
//           req.currentMember = mem;
//           req.session.member_id = mem.id;
//           res.redirect('/');
//         } else {
//           res.redirect('/login');
//           Notify.problem(err);
//         }
//       });
//     } else {
//       res.redirect('/login');
//       Notify.problem(err);
//     }
//   });
// });


// Add media form
app.get('/add', loadMember, function (req, res) {
  if (req.currentMember.role !== 'contributor') {
    res.redirect('/');
    return;
  }
  findMedia(function (grid) {
    getTwitterNames(function (names) {
      res.render('index', {
          part  : 'add'
        , data  : new Media()
        , tlip  : transloadit
        , grid  : grid 
        , cm    : req.currentMember
        , names : names    
      });
    });
  });
});


// Get tag results
app.get('/search/:by.:format?', loadMember, function (req, res) {
  var filter
    , by = req.body.by
    , val = makeTerms(req.body.val)
  ;
  // if (val.length > 1) {
  //   filter = { $nor: [] };
  //   for (var i=0; i < by.length; i++) {
  //     fil = {};
  //     fil[by[i]] = { $not: { $in: val } }
  //     filter.$nor.push(fil);
  //   }
  if (val[0] != '') {
    filter = { $or: [] }
    for (var i=0; i < by.length; i++) {
      fil = {};
      fil[by[i]] = { $in: val }
      filter.$or.push(fil);
    }
  }
  // filter = { $nor: [], $or: [] };
  // if (val[0] != '') {
  //   for (var i=0; i < by.length; i++) {
  //     or = {};
  //     or[by[i]] = { $all: val };
  //     filter.$or.push(or);
  //     
  //     nor = {};
  //     nor[by[i]] = { $not: { $in: val } };
  //     filter.$nor.push(nor);
  //   }
  // }
  findMedia(function (media) {
    var rendered = []
      , num = media.length
      , cnt = 0
    ;
    if (num > 0)
      media.forEach(function (med) {
        renderObject(med, function (ren) {
          if ('string' == typeof ren)
            rendered.push(ren);
          else {
            res.send({ status: 'error', message: ren.message });
            return;
          }
          cnt++;
          if (cnt == num)
            res.send({ status: 'success', data: { objects: rendered } });
        });
      });
    else
      res.send({ status: 'success', data: { objects: rendered } });
  }, filter);
});


// Single object
app.get('/:key', loadMember, function (req, res) {
  Media.findOne({ key: req.params.key }, function (err, med) {
    for (var i = 0, len = med.terms.length; i < len; i++) {
      console.log(med.terms[i]);
    }
    Member.findById(med.member_id, function (err, mem) {
      med.member = mem;
      var hearts = 0
        , comments = []
        , num = med.comments.length
        , cnt = 0
      ;
      if (med.meta.ratings) {
        for (var i=0; i < med.meta.ratings.length; i++) {
          if (req.currentMember.id == med.meta.ratings[i].mid) {
            hearts = med.meta.ratings[i].hearts;
            break;
          }
        }
      }
      if (num == 0) {
        med.meta.hits++;
        med.save(function (err) {
          findMedia(function (grid) {
            getTwitterNames(function (names) {
              res.render('index', {
                  part   : 'single'
                , media  : med
                , coms   : comments
                , hearts : hearts
                , grid   : grid
                , cm     : req.currentMember
                , names  : names
              });
            });
          });
        });
      } else {
        med.comments.reverse();
        med.comments.forEach(function (cid) {
          Comment.findById(cid, function (err, com) {
            Member.findById(com.member_id, function (err, commentor) {
              com.member = commentor;
              comments.push(com);
              cnt++;
              if (cnt == num) {
                med.meta.hits++;
                med.save(function (err) {
                  findMedia(function (grid) {  
                    getTwitterNames(function (names) {
                      res.render('index', {
                          part   : 'single'
                        , media  : med
                        , coms   : comments
                        , hearts : hearts
                        , grid   : grid
                        , cm     : req.currentMember
                        , names  : names
                      });
                    });
                  });
                });
              }
            });
          });
        });
      }
    });
  });
});


// // Login - add member to session
// app.post('/sessions', function (req, res) {
//   var desiredPath = req.session.desiredPath || '/';
//   // check fields
//   var missing = [];
//   if (!req.body.member.email)
//     missing.push('email');
//   if (!req.body.member.password)
//     missing.push('password');
//   if (missing.length != 0) {
//     res.send({ status: 'fail', data: { code: 'MISSING_FIELD', message: 'Hey, we need both those fields to get you in here ;)', missing: missing } });
//     return;
//   }
//   Member.findOne({ email: req.body.member.email }, function (err, mem) {
//     if (mem && mem.authenticate(req.body.member.password)) {
//       if (!mem.confirmed) {
//         res.send({
//             status: 'fail'
//           , data: { 
//                 code: 'NOT_CONFIRMED'
//               , message: 'Hey there, ' + mem.name.first + '. You must confirm your account before we can let you in here. I can <a href="javascript:;" id="noconf-' + mem.id + '" class="resend-conf">re-send the confirmation email</a> if you\'d like.'
//             }
//         });
//         return;
//       }
//       mem.meta.logins++
//       mem.save(function (err) {
//         if (!err) {
//           req.session.member_id = mem.id;
//           if (req.body.remember_me) {
//             var loginToken = new LoginToken({ email: mem.email });
//             loginToken.save(function () {
//               res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
//               res.send({ status: 'success', data: { path: desiredPath } });
//             });
//           } else {
//             res.send({ status: 'success', data: { path: desiredPath } });
//           }
//         } else {
//           res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try to log in again later.' });
//           Notify.problem(err);
//         }
//       });
//     } else {
//       res.send({
//           status: 'fail'
//         , data: { 
//               code: 'BAD_AUTH'
//             , message: 'Hey, sorry. That didn\'t work. Your email or password is incorrect.'
//           }
//       });
//     }
//   });
// });


// // Resend Confirmation Email
// app.post('/resendconf/:id?', function (req, res) {
//   if (!req.params.id) {
//     res.send({ status: 'error', message: 'Invalid request.' });
//     return;
//   } else {
//     Member.findById(req.body.id, function (err, mem) {
//       if (mem) {
//         var confirm = 'http://' + path.join(req.headers.host, 'confirm', mem.id);
//         Notify.welcome(mem, confirm, function (err, message) {
//           if (!err)
//             res.send({ status: 'success', data: { message: 'Excellent, ' + mem.name.first + '. Please check your inbox for the next step. There\'s only one more... I promise.', member: mem } });
//           else {
//             res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try registering again later.' });
//             Notify.problem(err);
//           }
//         });
//       } else
//         res.send({ status: 'error', message: 'Oops, we lost your account info. Please register again.' });
//     });
//   }
// });


// // Add Member
// app.put('/members', function (req, res) {
//   //res.send({ status: 'error', message: 'Hey, you can\'t do that yet!' });
//   //return;
//   // check fields
//   var missing = [];
//   if (!req.body.newmember['name.first'])
//     missing.push('name.first');
//   if (!req.body.newmember['name.last'])
//     missing.push('name.last');
//   if (!req.body.newmember.email)
//     missing.push('email');
//   if (!req.body.newmember.email2)
//     missing.push('email2');
//   if (!req.body.newmember.password)
//     missing.push('password');
//   if (missing.length != 0) {
//     res.send({ status: 'fail', data: { code: 'MISSING_FIELD', message: 'Hey, we need all those fields for this to work.', missing: missing } });
//     return;
//   }
//   // compare emails
//   if (req.body.newmember.email2 != req.body.newmember.email) {
//     res.send({ status: 'fail', data: { code: 'INVALID_EMAIL', message: 'Oops. You didn\'t re-enter your email address correctly. Please do it right and try registering again.' } });
//     return;
//   } else
//     delete req.body.newmember.email2;
//   // create new member
//   var member = new Member(req.body.newmember);
//   member.save(function (err) {
//     if (!err) {
//       var confirm = 'http://' + path.join(req.headers.host, 'confirm', member.id);
//       Notify.welcome(member, confirm, function (err, message) {
//         if (!err)
//           res.send({ status: 'success', data: { message: 'Excellent. Please check your inbox for the next step. There\'s only one more, I promise.', member: member } });
//         else {
//           res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try registering again later.' });
//           Notify.problem(err);
//         }
//       });
//     } else
//       res.send({ status: 'fail', data: { code: 'DUPLICATE_EMAIL', message: 'Your email address is already being used on our system. Please try registering with a different address.' } });
//   });
// });


// Add media from transloadit.com
app.put('/insert', loadMember, function (req, res, next) {
  
  // form params
  var media = req.body.media;
  media.member_id = req.currentMember.id;
  
  // determine type
  if (req.body.assembly.results.image_thumb) {
    // this is an image
    var attachment = {
        image_thumb : req.body.assembly.results.image_thumb['0']
      , image_full  : req.body.assembly.results.image_full['0']
    }
    media.attached = attachment;
    media.type = media.attached.image_full.type;
    var id;
    for (var i in media.attached)
      if (media.attached.hasOwnProperty(i)) {
        id = media.attached[i].id;
        media.attached[i].cf_url = 'http://d1da6a4is4i5z6.cloudfront.net/' + id.substr(0, 2) + '/' + id.substr(2) + '.' + media.attached[i].ext;  
      }
  } else if (req.body.assembly.results.video_encode) {
    // this is a video
    var attachment = {
        video_thumbs : req.body.assembly.results.video_thumbs
      , video_placeholder : req.body.assembly.results.video_placeholder['0']
      , video_poster : req.body.assembly.results.video_poster['0']
      , video_encode : req.body.assembly.results.video_encode['0']
    }
    media.attached = attachment;
    media.type = media.attached.video_encode.type;
    var id;
    for (var i in media.attached.video_thumbs)
      if (media.attached.video_thumbs.hasOwnProperty(i)) {
        id = media.attached.video_thumbs[i].id;
        media.attached.video_thumbs[i].cf_url = 'http://d1ehvayr9dfk4s.cloudfront.net/' + id.substr(0, 2) + '/' + id.substr(2) + '.' + media.attached.video_thumbs[i].ext;
      }
    id = media.attached.video_placeholder.id;
    media.attached.video_placeholder.cf_url = 'http://d1ehvayr9dfk4s.cloudfront.net/' + id.substr(0, 2) + '/' + id.substr(2) + '.' + media.attached.video_placeholder.ext;
    id = media.attached.video_poster.id;
    media.attached.video_poster.cf_url = 'http://d1ehvayr9dfk4s.cloudfront.net/' + id.substr(0, 2) + '/' + id.substr(2) + '.' + media.attached.video_poster.ext;
    id = media.attached.video_encode.id;
    media.attached.video_encode.cf_url = 'http://d1ehvayr9dfk4s.cloudfront.net/' + id.substr(0, 2) + '/' + id.substr(2) + '.' + media.attached.video_encode.ext;
  }
  
  // save it
  var doc = new Media(media);
  doc.save(function (err) {
    if (!err)
      res.send({ status: 'success', data: { id: doc._id } });
    else
      res.send({ status: 'error', message: err.message });
  });
  
});


// Add comment
app.put('/comment/:id.:format?', loadMember, function (req, res, next) {
  Media.findById(req.body.pid, function (err, med) {
    if (!err) {
      var comment = {
          body      : req.body.comment
        , member_id : req.currentMember.id
        , parent_id : req.body.pid
      };
      var com = new Comment(comment);
      com.save(function (err) {
        if (!err) {
          med.comments.push(com._id);
          med.save(function (err) {
            if (!err)
              res.send({ status: 'success', data: { pid: med.id, comment: com } });
            else
              res.send({ status: 'error', message: err.message });
          });
        } else
          res.send({ status: 'error', message: err.message });
      });
    } else
      res.send({ status: 'error', message: err.message });
  });
});


// Add hearts
app.put('/hearts/:id.:format?', loadMember, function (req, res, next) {
  Media.findById(req.body.id, function (err, med) {
    if (!err) {
      var num = med.meta.ratings ? med.meta.ratings.length : 0
        , cnt = 0
      ;
      if (num == 0) {
        med.meta.ratings = [];
        med.meta.ratings.push({
            member_id : req.currentMember.id
          , hearts    : req.body.hearts
        });
        med.save(function (err) {
          if (!err) {
            res.send({ status: 'success', data: { hearts: med.meta.hearts } });
          } else
            res.send({ status: 'error', message: err.message });
        });
      } else
        med.meta.ratings.forEach(function (rat) {
          if (rat.mid == req.currentMember.id) {
            rat.hearts = req.body.hearts;
            med.save(function (err) {
              if (!err) {
                res.send({ status: 'success', data: { hearts: med.meta.hearts } });
              } else
                res.send({ status: 'error', message: err.message });
            });
            return;
          }
          cnt++;
          if (cnt == num) {
            med.meta.ratings.push({
                member_id : req.currentMember.id
              , hearts    : req.body.hearts
            });
            med.save(function (err) {
              if (!err) {
                res.send({ status: 'success', data: { hearts: med.meta.hearts } });
              } else
                res.send({ status: 'error', message: err.message });
            });
          }
        });
    } else
      res.send({ status: 'error', message: err.message });
  });
});


// // Delete a session on logout
// app.del('/sessions', loadMember, function (req, res) {
//   if (req.session) {
//     LoginToken.remove({ email: req.currentMember.email }, function () {});
//     res.clearCookie('logintoken');
//     req.session.destroy(function () {});
//   }
//   res.redirect('/login');
// });


////////////// Initialize and Listen

var memberDb;

if (!module.parent) {

  Step(
    // Connect to MemberDb:
    function () {
      log('Connecting to MemberDb:', argv.db);
      mongodb.connect(argv.db, { server: { poolSize: 4 } }, this);
    }, function (err, db) {
      if (err) return this(err);
      new MemberDb(db, { ensureIndexes: true }, this);
    }, function (err, mDb) {
      if (err) return this(err);
      memberDb = mDb;
      this();
    },

    // Listen:
    function (err) {
      if (err) return this(err);
      app.listen(argv.port);

      // init now.js
      var everyone = now.initialize(app);

      // add new object to everyone's page
      everyone.now.distributeObject = function (id) {
        Media.findById(id, function (err, obj) {
          if (!err)
            renderObject(obj, function (ren) {
              if ('string' == typeof ren)
                everyone.now.receiveObject({ status: 'success', data: { obj: ren } });
              else
                everyone.now.receiveObject({ status: 'error', message: ren.message });
            });
          else
            everyone.now.receiveObject({ status: 'error', message: err.message });
        });
      };

      // add new comment to everyone's page
      everyone.now.distributeComment = function (data) {
        renderComment(data.comment, function (cren, rren) {
          if ('string' == typeof cren && 'string' == typeof rren)
            everyone.now.receiveComment({ status: 'success', 
                data: { pid: data.pid, com: cren, rec: rren } });
          else
            everyone.now.receiveComment({ status: 'error', message: cren.message || rren.message });
        });
      };

      // update everyone with new trends
      var distributeTrends = function () {
        getTrending(5, function (trends) {
          var rendered = [];
          trends.forEach(function (trend) {
            rendered.push(templates.trend({ trend: trend }));
          });
          if (everyone.now.receiveTrends) {
            everyone.now.receiveTrends({ status: 'success', data: { trends: rendered } });
          }
        });
      };
      setInterval(distributeTrends, 5000);

      // .server.socket.set('authorization', function (data, cb) {
      //   var cookies = connect.utils.parseCookie(data.headers.cookie);
      //   var sid = cookies['connect.sid'];
      //   app.settings.sessionStore.load(sid, function (err, sess) {
      //     if (err) {
      //       log("Error: Failed finding session", '(' + sid + ')');
      //       return cb(err);
      //     }
      //     if (!sess) {
      //       // log("Error: Invalid session", '(sid:' + sid + ')');
      //       return cb(new Error('Could not find session.'));
      //     }
      //     log("Session opened", '(sid:' + sid + ')');
      //     data.session = sess;
      //     cb(null, true);
      //   });
      //   // TODO: Keep the session alive on with a timeout.
      // });
      log("Express server listening on port", app.address().port);
    }
  );
}





