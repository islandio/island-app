/*
 * member.js: Handling for the member resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var url = require('url');
var util = require('util');
var crypto = require('crypto');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;
var InstagramStrategy = require('passport-instagram').Strategy;
var Facebook = require('node-fb');
var db = require('../db.js');
var com = require('../common.js');

/* e.g.,
  {
    "_id" : <ObjectId>,
    "key" : <String>,
    "username": <String>,
    "password": <String>,
    "salt": <String>,
    "role": <Number>,
    "primaryEmail": <String>,
    "emails" : [
      {
        "value" : <String>
      }
    ],
    "displayName" : <String>,
    "name" : {
      "familyName" : <String>,
      "givenName" : <String>,
      "middleName" : <String>
    },
    "description" : <String>,
    "config" : {
      "notifications" : {
        "comment" : {
          "email" : <Boolean>
        }
      }
    },
    "modified" : <Boolean>,
    "confirmed" : <Boolean>,
    "provider": <String>,
    "facebook" : <String>,
    "facebookId" : <String>,
    "facebookToken" : <String>,
    "profileUrl": "<String>,
    "twitter": <String>,
    "twitterId" : <String>,
    "twitterToken" : <String>,
    "instagram" : <String>,
    "instagramId" : <String>,
    "instagramToken" : <String>,
    "image" : <Object>,
    "thumbs": [<Object>],
    "gender" : <String>,
    "birthday" : <String>,
    "hometown" : {
      "name" : <String>,
      "city" : <String>,
      "state" : <String>,
      "country" : <String>,
      "latitude" : <Number>,
      "longitude" : <Number>
    },
    "locale" : <String>,
    "location" : {
      "name" : <String>,
      "latitude" : <Number>,
      "longitude" : <Number>
    },
    "timezone": <Number>,
    "website": <String>,
    "created" : <ISODate>,
    "updated" : <ISODate>
  }
*/

/*
 * Authorize the session member.
 */
// var authorize = exports.authorize = function (req, res, cb) {
//   var id = req.session.passport.user;
//   if (!id) {
//     req.session.referer = req.originalUrl;
//     return res.redirect('/login');
//   }
//   db.Members.read({ _id: new db.oid(id)}, function (err, member) {
//     if (err) return cb(err);
//     if (!member) {
//       req.session.passport = {};
//       res.redirect('/login');
//       return cb(new Error('Member and Session do NOT match'));
//     }
//     req.user = member;
//     cb(null, member);
//   });
// }

/*
 * Combine shitty passport email lists.
 */
function mergeEmails(a, b, first) {
  if (!a) a = [];
  if (!b) b = [];
  var ta = _.pluck(a, 'value');
  var tb = _.pluck(b, 'value');
  var tc = _.union(ta, tb);
  if (first) tc = _.without(tc, first);
  var c = [];
  _.each(tc, function (val) { c.push({value: val}); });
  if (first) c.unshift({value: first});
  return c;
}

// Define routes.
exports.routes = function (app) {

  //
  // Passport auth/authz
  //

  // Serialize members (users) for requests.
  passport.serializeUser(function (member, cb) {
    cb(null, member._id.toString());
  });

  // De-serialize members (users) for requests.
  passport.deserializeUser(function (id, cb) {
    db.Members.read({_id: db.oid(id)}, function (err, mem) {
      delete mem.password;
      delete mem.salt;
      mem.gravatar = crypto.createHash('md5').update(mem.primaryEmail)
          .digest('hex');
      cb(err, mem);
    });
  });

  // Local authenticate
  // passport.use(new LocalStrategy(
  //   function (email, password, cb) {
  //     memberDb.collections.member.findOne({emails: {value: email}},
  //         function (err, member) {
  //       if (err) return cb(err);
  //       if (!member) return cb(null, false);
  //       if (!member.password)
  //         return cb(null, member, { waiting: true });
  //       if (!MemberDb.authenticateLocalMember(member, password))
  //         return cb(null, false);
  //       return cb(null, member);
  //     });
  //   }
  // ));
  
  // Facebook authenticate
  passport.use(new FacebookStrategy(app.get('facebook'),
    function (token, refresh, props, cb) {
      props.facebookToken = token;
      props.facebookRefresh = refresh;
      delete props._raw;
      delete props._json;
      props.emails = props.emails ? _.filter(props.emails, function (e) {
        return e !== null;
      }) : [];
      props.facebookId = props.id;
      delete props.id;
      db.Members.read({$or: [{ emails: {$in: props.emails}},
          {facebookId: props.facebookId}]}, function (err, member) {
        if (err) return cb(err);
        if (member && member.key) {
          if (member.modified) {
            var update = { 
              facebookToken: props.facebookToken,
              facebookId: props.facebookId
            };
            db.Members.update({_id: member._id}, {$set: update},
                function (err) {
              if (err) return cb(err);
              cb(null, _.extend(member, update));
            });
          } else updateFacebookData(member);
        } else {
          props.key = com.key();
          updateFacebookData(member);
        }
      });
      function updateFacebookData(member) {
        var facebook = new Facebook(app.get('facebook'));
        Step(
          function () {
            facebook.get(props.facebookId,
                {access_token: props.facebookToken}, this);
          },
          function (err, data) {
            if (err) return this(true);
            _.extend(props, {
              locale: data.locale,
              timezone: data.timezone,
              gender: data.gender,
              birthday: data.birthday,
              website: data.website
            });
            if (data.location)
              facebook.get(data.location.id, {}, this.parallel());
            else this.parallel()();
            if (data.hometown)
              facebook.get(data.hometown.id, {}, this.parallel());
            else this.parallel()();
            facebook.get(props.facebookId + '/albums',
                {access_token: props.facebookToken}, this.parallel());
          },
          function (err, location, hometown, albums) {
            if (err) return this(true);
            if (location) {
              props.location = {name: location.name};
              _.extend(props.location, location.location);
            } else props.location = null;
            if (hometown) {
              props.hometown = {name: hometown.name};
              _.extend(props.hometown, hometown.location);
            } else props.hometown = null;
            var photo = _.find(albums, function (album) {
              return album.name === 'Cover Photos';
            });
            if (photo && photo.cover_photo)
              facebook.get(photo.cover_photo,
                  {access_token: props.facebookToken}, this);
            else this();
          },
          function (err, data) {
            if (data) {
              props.image = {
                cf_url: data.source,
                meta: {width: data.width, height: data.height},
              };
              props.thumbs = [props.image];
            }
            props.facebook = props.username;
            if (member) {
              delete props.displayName;
              if (member.name) delete props.name;
              delete member.username;
              props.username = member.username || member.key;
              props.emails = mergeEmails(props.emails, member.emails,
                  member.primaryEmail);
              _.defaults(props, member);
              props.primaryEmail = member.primaryEmail;
              db.Members._update({_id: member._id}, props, function (err) {
                if (err) return cb(err);
                cb(null, props);
              });
            } else if (!member) {
              _.defaults(props, {
                role: 1,
                image: null,
                thumbs: null,
                confirmed: false,
                modified: false,
                config: {
                  notifications: {
                    comment: {
                      email: true
                    }
                  }
                }
              });
              props.primaryEmail = props.emails.length > 0 ?
                  props.emails[0].value: null;
              props.username = props.key;
              db.Members.create(props, cb);
            }
          }
        );
      }
    }
  ));
  
  // Facebook authorize
  passport.use('facebook-authz', new FacebookStrategy(app.get('facebook'),
    function (token, refreshToken, profile, cb) {
      memberDb.collections.member.findOne({facebookId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          facebookToken: token,
          facebookRefresh: refreshToken,
          facebookId: profile.id,
          facebook: profile.username,
        });
      });
    }
  ));
  
  // Twitter authenticate
  passport.use(new TwitterStrategy(app.get('twitter'),
    function (token, tokenSecret, profile, cb) {
      profile.twitterToken = token;
      profile.twitterSecret = tokenSecret;
      memberDb.findOrCreateMemberFromTwitter(profile, function (err, member) {
        cb(err, member);
      });
    }
  ));
  
  // Twitter authorize
  passport.use('twitter-authz', new TwitterStrategy(app.get('twitter'),
    function (token, tokenSecret, profile, cb) {
      memberDb.collections.member.findOne({twitterId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          twitterToken: token,
          twitterSecret: tokenSecret,
          twitterId: profile.id,
          twitter: profile.username,
        });
      });
    }
  ));

  // Instagram authorize
  passport.use('instagram-authz', new InstagramStrategy(app.get('instagram'),
    function (token, refreshToken, profile, cb) {
      memberDb.collections.member.findOne({instagramId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          instagramToken: token,
          instagramRefresh: refreshToken,
          instagramId: profile.id,
          instagram: profile.username,
        });
      });
    }
  ));

  //
  // API
  //

  // read
  app.get('/api/members/:un', function (req, res) {
    var profile = {member: req.session.user, content: {}};
    Step(
      function () {
        db.Members.read({username: req.params.un}, this);
      },
      function (err, member) {
        profile.content.page = member;
        db.Comments.find({member_id: member._id}).toArray(this);
      },
      function (err, comments) {
        profile.content.comments = comments;
        res.send(profile);
        // if (err || !member)
        // return res.render('404', { title: 'Not Found' });
        // _.each(member, function (v, k) {
        //   if (v === '') member[k] = null;
        // });
        // res.render('member', {
        //   title: member.displayName,
        //   data: member,
        //   member: req.user,
        //   // util: templateUtil
        // });
      }
    );
  });

  // // edit
  // app.get('/settings/:key', authorize, function (req, res) {
  //   Step(
  //     function () {
  //       memberDb.findMemberByKey(req.params.key, this.parallel());
  //     },
  //     function (err, member) {
  //       if (err || !member || member._id.toString()
  //           !== req.user._id.toString())
  //         return res.redirect('/login');
  //       _.each(member, function (v, k) {
  //         if (v === '') member[k] = null;
  //       });
  //       res.render('settings', {
  //         title: 'Settings',
  //         data: member,
  //         transloaditParams: transloaditProfileParams,
  //         member: req.user,
  //       });
  //     }
  //   );
  // });

  // // update
  // app.put('/members', authorize, function (req, res) {
  //   if (!req.body.member || !req.body.member.primaryEmail
  //       || !req.body.member.username || req.body.member._id
  //       !== req.user._id.toString())
  //     return done(new Error('Failed to save member settings'));
  //   var member = req.body.member;
  //   var assembly = req.body.member.assembly ?
  //                   JSON.parse(req.body.member.assembly) : null;
  //   function done(err) {
  //     if (err)
  //       return res.send({
  //         status: 'error',
  //         data: 'string' === typeof err ?
  //               null : err.data || err.stack,
  //       });
  //     res.send({ status: 'success' });
  //   }
  //   Step(
  //     function () {
  //       memberDb.findMemberById(req.user._id, true, this.parallel());
  //       memberDb.collections.member.findOne({ emails: { value: member.primaryEmail }},
  //                                           this.parallel());
  //       memberDb.collections.member.findOne({ $or: [{ username: member.username },
  //                                           { key: member.username }]}, this.parallel());
  //     },
  //     function (err, doc, byEmail, byUsername) {
  //       if (err) return done(err);
  //       if (!doc) return done('Could not find member');
  //       if (byEmail && byEmail._id.toString() !== doc._id.toString())
  //         return done({ data: { inUse: 'primaryEmail' }});
  //       if (byUsername && byUsername._id.toString() !== doc._id.toString())
  //         return done({ data: { inUse: 'username' }});
  //       doc.username = member.username;
  //       var tempEmails = _.pluck(doc.emails, 'value');
  //       if (!_.include(tempEmails, member.primaryEmail))
  //         doc.emails.unshift({ value: member.primaryEmail });
  //       doc.primaryEmail = member.primaryEmail;
  //       doc.displayName = member.displayName;
  //       doc.name = MemberDb.getMemberNameFromDisplayName(doc.displayName);
  //       if (assembly) {
  //         doc.image = assembly.results.image_full[0];
  //         doc.image.cf_url = cloudfrontImageUrl
  //                             + doc.image.id.substr(0, 2)
  //                             + '/' + doc.image.id.substr(2)
  //                             + '.' + doc.image.ext;
  //         doc.thumbs = assembly.results.image_thumb;
  //         _.each(doc.thumbs, function (thumb) {
  //           thumb.cf_url = cloudfrontImageUrl
  //                           + thumb.id.substr(0, 2)
  //                           + '/' + thumb.id.substr(2)
  //                           + '.' + thumb.ext;
  //         });
  //       }
  //       if (member.bannerLeft !== '') {
  //         doc.image.meta.left = member.bannerLeft * (640/232);
  //         doc.thumbs[0].meta.left = member.bannerLeft;
  //       }
  //       if (member.bannerTop !== '') {
  //         doc.image.meta.top = member.bannerTop * (640/232);
  //         doc.thumbs[0].meta.top = member.bannerTop;
  //       }
  //       doc.description = member.description;
  //       if (doc.location)
  //         doc.location.name = member.location;
  //       else
  //         doc.location = { name: member.location };
  //       if (doc.hometown)
  //         doc.hometown.name = member.hometown;
  //       else
  //         doc.hometown = { name: member.hometown };
  //       if ('' !== member.birthday) {
  //         var birthday = new Date(member.birthday);
  //         if (!templateUtil.isValidDate(birthday))
  //           return done({ data: { invalid: 'birthday' }});

  //         var month = String(birthday.getMonth() + 1);
  //         if (month.length < 2) month = '0' + month;
  //         var date = String(birthday.getDate());
  //         if (date.length < 2) date = '0' + date;
  //         var year = String(birthday.getFullYear());
  //         doc.birthday = month + '/' + date + '/' + year;
  //       }
  //       doc.gender = member.gender;
  //       var urls = member.website.match(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig);
  //       doc.website = '';
  //       _.each(urls, function (url, i) {
  //         doc.website += url;
  //         if (i !== urls.length - 1)
  //           doc.website += '\n';
  //       });
  //       doc.twitter = member.twitter;
  //       doc.modified = true;
  //       doc.config.notifications.comment.email = member.config.notifications.comment.email;
  //       memberDb.collections.member.update({ _id: doc._id },
  //                                           doc, { safe: true }, done);
  //     }
  //   );
  // });

  // // delete
  // app.delete('/members', authorize, function (req, res) {
  //   if (!req.body.password)
  //     fail(new Error('Failed to delete member.'));
  //   if (!MemberDb.authenticateLocalMember(req.user, req.body.password))
  //     return res.send({ status: 'fail', data: { message: 'Invalid password.' }});
  //   Step(
  //     function () {
  //       var id = req.user._id;
  //       memberDb.collections.member.remove({ _id: id }, this.parallel());
  //       memberDb.collections.hit.remove({ member_id: id }, this.parallel());
  //       memberDb.collections.view.remove({ member_id: id }, this.parallel());
  //       memberDb.collections.rating.remove({ member_id: id }, this.parallel());
  //       memberDb.collections.comment.remove({ member_id: id }, this.parallel());
  //       memberDb.collections.post.remove({ member_id: id }, this.parallel());
  //       memberDb.collections.media.remove({ member_id: id }, this.parallel());
  //       eventDb.collections.subscription.remove({ member_id: id }, this.parallel());
  //     },
  //     function (err) {
  //       if (err) return fail(err);
  //       console.log('\nDeleted member: ' + inspect(req.user) + '\n');
  //       req.logOut();
  //       delete req.session.referer;
  //       res.send({ status: 'success' });
  //     }
  //   );
  //   function fail(err) {
  //     res.send({ status: 'error',
  //              message: err.stack });
  //   }
  // });

  // // Basic password authentication
  // app.post('/login', function (req, res, next) {
  //   var missing = [];
  //   if (!req.body.username)
  //     missing.push('username');
  //   if (!req.body.password)
  //     missing.push('password');
  //   if (missing.length !== 0)
  //     return res.send({
  //       status: 'fail', 
  //       data: { code: 'MISSING_FIELD',
  //               message: 'All fields are required.',
  //               missing: missing },
  //     });
  //   passport.authenticate('local', function (err, member, info) {
  //     if (err) return next(err);
  //     if (!member)
  //       return res.send({
  //         status: 'fail',
  //         data: {
  //           code: 'BAD_AUTH',
  //           message: 'Your email or password is incorrect.'
  //         }
  //       });
  //     if (info && info.waiting) {
  //       missing.push('password');
  //       return res.send({
  //         status: 'fail',
  //         data: {
  //           code: 'ACCOUNT_WAITING',
  //           message: member.displayName
  //                   + ', Island underwent some changes since we last saw you. '
  //                   + 'To reactivate your account, please set a new password by '
  //                   + 'following the 1-step signup process using this '
  //                   + 'email address (' + member.primaryEmail + ').',
  //           missing: missing
  //         }
  //       });
  //     }
  //     req.logIn(member, function (err) {
  //       if (err) return next(err);
  //       var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
  //       referer.search = referer.query = referer.hash = null;
  //       referer.pathname = '/';
  //       res.send({
  //         status: 'success',
  //         data: { path: url.format(req.session.referer || referer) },
  //       });
  //     });
  //   })(req, res, next);
  // });

  // Facebook authentication
  app.get('/auth/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    referer.pathname = '/auth/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook']._callbackURL = returnUrl;
    passport.authenticate('facebook', { scope: [
                          'email',
                          'user_about_me',
                          'user_birthday',
                          'user_website',
                          'user_status',
                          'user_photos',
                          'read_stream',
                          'publish_stream']})(req, res, next);
  });

  // Facebook returns here
  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', function (err, member, info) {
      if (err) return next(err);
      if (!member)
        return res.redirect('/login');
      if (!member.password) {
        req.session.temp = {provider: 'facebook', member: member};
        return res.redirect('/login');
      }
      req.logIn(member, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next); 
  });

  // Facebook authorization
  app.get('/connect/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook-authz']._callbackURL = returnUrl;
    passport.authorize('facebook-authz', { scope: [
                          'email',
                          'user_about_me',
                          'user_birthday',
                          'user_website',
                          'user_status',
                          'user_photos',
                          'read_stream',
                          'publish_stream']})(req, res, next);
  });

  // Facebook authorization returns here
  app.get('/connect/facebook/callback', function (req, res, next) {
    passport.authorize('facebook-authz', function (err, member, info) {
      if (err) return next(err);
      info.modified = true;
      memberDb.collections.member.update({ _id: req.user._id },
                                          { $set: info }, { safe: true },
                                          function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Twitter authentication
  app.get('/auth/twitter', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    referer.pathname = '/auth/twitter/callback';
    var returnUrl = url.format(referer);
    passport._strategies['twitter']._oauth._authorize_callback = returnUrl;
    passport.authenticate('twitter')(req, res, next);
  });

  // Twitter authentication returns here
  app.get('/auth/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', function (err, member, info) {
      if (err) return next(err);
      if (!member)
        return res.redirect('/login');
      if (!member.password) {
        req.session.temp = { provider: 'twitter', member: member };
        return res.redirect('/login');
      }
      req.logIn(member, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Twitter authorization
  app.get('/connect/twitter', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/twitter/callback';
    var returnUrl = url.format(referer);
    passport._strategies['twitter-authz']._oauth._authorize_callback = returnUrl;
    passport.authorize('twitter-authz')(req, res, next);
  });

  // Twitter authorization returns here
  app.get('/connect/twitter/callback', function (req, res, next) {
    passport.authorize('twitter-authz', function (err, member, info) {
      if (err) return next(err);
      info.modified = true;
      memberDb.collections.member.update({ _id: req.user._id },
                                          { $set: info }, { safe: true },
                                          function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Instagram authorization
  app.get('/connect/instagram', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/instagram/callback';
    var returnUrl = url.format(referer);
    passport._strategies['instagram-authz']._callbackURL = returnUrl;
    passport.authorize('instagram-authz')(req, res, next);
  });

  // Instagram authorization returns here
  app.get('/connect/instagram/callback', function (req, res, next) {
    passport.authorize('instagram-authz', function (err, member, info) {
      if (err) return next(err);
      info.modified = true;
      memberDb.collections.member.update({ _id: req.user._id },
                                          { $set: info }, { safe: true },
                                          function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // // Create a new member with local authentication
  // app.put('/signup', function (req, res, next) {
  //   var missing = [];
  //   if (!req.body.newname)
  //     missing.push('newname');
  //   if (!req.body.newusername)
  //     missing.push('newusername');
  //   if (!req.body.newpassword)
  //     missing.push('newpassword');
  //   if (missing.length !== 0)
  //     return res.send({
  //       status: 'fail', 
  //       data: { code: 'MISSING_FIELD',
  //               message: 'All fields are required.',
  //               missing: missing },
  //     });
  //   req.body.newusername = req.body.newusername.toLowerCase();
  //   if (!(/^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$/).test(req.body.newusername))
  //     return res.send({
  //       status: 'fail',
  //       data: { code: 'INVALID_EMAIL',
  //               message: 'Please use a valid email address.' },
  //     });
  //   if (req.body.id) {
  //     Step(
  //       function () {
  //         var _this = this;
  //         memberDb.findMemberById(req.body.id, true, function (err, member) {
  //           if (err) return next(err);
  //           if (!member)
  //             return res.send({
  //               status: 'fail', 
  //               data: { code: 'INTERNAL_ERROR',
  //                       message: 'Oops! Something went wrong :( Please start over.' },
  //             });
  //           memberDb.collections.member.findOne({ emails: {
  //                                               value: req.body.newusername }},
  //                                               function (err, doc) {
  //             if (err) return next(err);
  //             if (doc && doc._id.toString() !== member._id.toString()) {
  //               // TEMP: match new admins with old accounts.
  //               if (doc.role === 0 && !doc.key) {
  //                 memberDb.collections.member.remove({ _id: member._id },
  //                                                   { safe: true },
  //                                                   function (err, result) {
  //                   if (err) return next(err);
  //                   _.defaults(doc, member);
  //                   _this(null, doc);
  //                 });
  //               } else return duplicate();
  //             } else _this(null, member);
  //           });
  //         });
  //       },
  //       function (err, member) {
  //         member.primaryEmail = req.body.newusername;
  //         var tempEmails = _.pluck(member.emails, 'value');
  //         if (!_.include(tempEmails, member.primaryEmail))
  //           member.emails.unshift({ value: member.primaryEmail });
  //         member.name = MemberDb.getMemberNameFromDisplayName(req.body.newname);
  //         member.displayName = member.name.givenName + (member.name.middleName ?
  //                             ' ' + member.name.middleName : '') +
  //                             ' ' + member.name.familyName;
  //         member.password = req.body.newpassword;
  //         MemberDb.dealWithPassword(member);
  //         memberDb.collections.member.update({ _id: member._id },
  //                                             member, { safe: true },
  //                                             function (err) {
  //           if (err) return next(err);
  //           req.logIn(member, function (err) {
  //             if (err) return next(err);
  //             sendMessage(member);
  //           });
  //         });
  //       }
  //     );
  //   } else {
  //     var props = {
  //       primaryEmail: req.body.newusername,
  //       emails: [ { value: req.body.newusername } ],
  //       displayName: req.body.newname,
  //       password: req.body.newpassword,
  //       provider: 'local',
  //     };
  //     memberDb.findOrCreateMemberFromEmail(props,
  //         { safe: true }, function (err, member) {
  //       if (err)
  //         return duplicate();
  //       req.logIn(member, function (err) {
  //         if (err) return next(err);
  //         sendMessage(member);
  //       });
  //     });
  //   }
  //   function sendMessage(member) {
  //     var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
  //     referer.search = referer.query = referer.hash = null;
  //     referer.pathname = '/';
  //     var confirm = path.join(url.format(referer), 'confirm', member._id.toString());
  //     Email.welcome(member, confirm, function (err, msg) {
  //       if (err) return next(err);
  //       res.send({
  //         status: 'success',
  //         data: {
  //           path: url.format(req.session.referer || referer),
  //           // message: 'Cool, ' + member.displayName + '. We just sent you a message.'
  //           //           + ' Please follow the enclosed link to confirm your account ...'
  //           //           + ' and thanks for checking out Island!',
  //           member: member,
  //         },
  //       });
  //     });
  //   }
  //   function duplicate() {
  //     res.send({
  //       status: 'fail',
  //       data: {
  //         code: 'DUPLICATE_EMAIL',
  //         message: 'That email address is already in use.'
  //       },
  //     });
  //   }
  // });

  // // Confirm page
  // app.get('/confirm/:id', function (req, res, next) {
  //   if (!req.params.id)
  //     return res.render('404', { title: 'Not Found' });
  //   memberDb.findMemberById(req.params.id, true, function (err, member) {
  //     if (err) return next(err);
  //     if (!member)
  //       return res.render('404', { title: 'Not Found' });
  //     memberDb.collections.member.update({ _id: member._id },
  //                                       { $set : { confirmed: true }},
  //                                       { safe: true }, function (err, result) {
  //       if (err) return next(err);
  //       if (!result) return res.render('404', { title: 'Not Found' });
  //       req.logIn(member, function (err) {
  //         if (err) return next(err);
  //         res.redirect('/');
  //       });
  //     });
  //   });
  // });

  // // Resend Confirmation Email
  // app.post('/resendconf/:id', authorize, function (req, res) {
  //   if (!req.params.id)
  //     return res.send({
  //       status: 'error',
  //       message: 'Invalid request.',
  //     });
  //   memberDb.findMemberById(req.params.id, true, function (err, member) {
  //     if (err) return next(err);
  //     if (!member)
  //       return res.send({
  //         status: 'error',
  //         message: 'Something went wrong. Please register again.',
  //       });
  //     var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
  //     referer.search = referer.query = referer.hash = null;
  //     referer.pathname = '/';
  //     var confirm = path.join(url.format(referer), 'confirm', member._id.toString());
  //     Email.welcome(member, confirm, function (err) {
  //       if (err) return next(err);
  //       res.send({
  //         status: 'success',
  //         data: {
  //           message: 'Cool, ' + member.name.givenName + '. We just sent you a message.'
  //                     + ' Please follow the enclosed link to confirm your account...'
  //                     + ' then you can comment and stuff.',
  //           member: member,
  //         },
  //       });
  //     });
  //   });
  // });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
