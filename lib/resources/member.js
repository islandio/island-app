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
 * Encrypt password.
 */
function encryptPassword(password, salt) {
  return crypto.createHmac('sha1', salt).update(password).digest('hex');
}

/*
 * Check password.
 */
function authenticateLocal(member, str) {
  return encryptPassword(str, member.salt) === member.password;
}

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

/*
 * Parse displayName into name parts.
 */
function getMemberNameFromDisplayName(displayName) {
  var name = _.without(displayName.split(' '), '');
  var family = '';
  var given = _.capitalize(name[0]);
  var middle = null;
  if (name.length > 2) {
    middle = _.capitalize(name[1]);
    family = _.capitalize(name[2]);
  } else if (name.length > 1)
    family = _.capitalize(name[1]);
  return {
    familyName: family,
    givenName: given,
    middleName: middle,
  };
}

// Do any initializations
exports.init = function (app) {
  return exports;
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
  //       if (!authenticateLocal(member, password))
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
      db.Members.read({$or: [{emails: {$in: props.emails}},
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
      db.Members.read({facebookId: profile.id},
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
    function (token, secret, props, cb) {
      props.twitterToken = token;
      props.twitterSecret = secret;
      props.emails = props.emails ? _.filter(props.emails, function (e) { 
        return e !== null;
      }) : [];
      props.twitterId = props.id;
      delete props.id;
      db.Members.read({$or: [{emails: {$in: props.emails}},
          {twitterId: props.twitterId}]}, function (err, member) {
        if (err) return cb(err);
        if (member && member.key) {
          if (member.modified) {
            var update = {
              twitterToken: props.twitterToken,
              twitterId: props.twitterId
            };
            db.Members.update({_id: member._id}, {$set: update},
                function (err) {
              if (err) return cb(err);
              cb(null, _.extend(member, update));
            });
          } else updateTwitterData(member);
        } else
          props.key = com.key();
          updateTwitterData(member);
      });
      function updateTwitterData(member) {
        _.extend(props, _.pick(props._json, 'description', 'location', 'url'));
        delete props._raw;
        delete props._json;
        props.twitter = props.username;
        if (props.url)
          props.website = props.url;
        delete props.url;
        if (props.location)
          props.location = {name: props.location};
        props.name = getMemberNameFromDisplayName(props.displayName);
        if (member) {
          delete props.displayName;
          if (member.name) delete props.name;
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
          props.username = props.key;
          db.createDoc(self.collections.member, props, cb);
        }
      }
    }
  ));
  
  // Twitter authorize
  passport.use('twitter-authz', new TwitterStrategy(app.get('twitter'),
    function (token, tokenSecret, profile, cb) {
      db.Members.read({twitterId: profile.id},
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
      db.Members.read({instagramId: profile.id},
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
    
  });

  // update
  app.put('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'Member invalid'});

    var props = {$set: {}};
    var data = req.body;
    if (data.assembly) {
      data.image = data.assembly.results.image_full[0];
      data.image.cf_url = app.get('cloudfront').img
          + data.image.id.substr(0, 2) + '/' + data.image.id.substr(2)
          + '.' + data.image.ext;
      props.$set.image = data.image;
    }
    if (data.bannerLeft)
      props.$set['image.meta.left'] = data.bannerLeft * 640 / 480;
    if (data.bannerTop)
      props.$set['image.meta.top'] = data.bannerTop * 640 / 480;

    db.Members.update({username: req.params.un}, props,
        function (err, stat) {
      if (com.error(err, req, res, stat, 'member')) return;
      res.send({updated: true});
    });
  });

  // delete
  app.delete('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un
        || !req.body.password)
        // || !authenticateLocal(req.user, req.body.password))
      return res.send(403, {error: 'Member invalid'});

    res.send({deleted: true});
    return;

    var mid = req.user._id;
    Step(
      function () {

        // Get member's own posts and events.
        db.Posts.list({author_id: mid}, this.parallel());
        db.Events.list({actor_id: mid}, this.parallel());
      },
      function (err, posts, events) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Remove notifications for events where member's posts are target.
            var next = _.after(posts.length, this);
            _.each(posts, function (p) {
              db.Events.list({target_id: p._id}, function (err, events) {
                var _next = _.after(events.length, next);
                _.each(events, function (e) {
                  db.Notifications.remove({event_id: e._id}, _next);
                });
              });
            });
          },
          function () {

            // Remove others' content on member's posts.
            _.each(posts, function (p) {
              db.Comments.remove({parent_id: p._id}, this.parallel());
              db.Views.remove({parent_id: p._id}, this.parallel());
              db.Subscriptions.remove({subscribee_id: p._id}, this.parallel());
              db.Events.remove({target_id: p._id}, this.parallel());
            });

            // Remove member's content.
            db.Posts.remove({author_id: mid}, this.parallel());
            db.Medias.remove({author_id: mid}, this.parallel());
            db.Comments.remove({author_id: mid}, this.parallel());
            db.Views.remove({author_id: mid}, this.parallel());
            db.Subscriptions.remove({$or: [{subscriber_id: mid},
                {subscribee_id: mid}]}, this.parallel());
            _.each(events, function (e) {
              db.Notifications.remove({event_id: e._id}, this.parallel());
            });
            db.Events.remove({actor_id: mid}, this.parallel());

            // Finally, remove the member.
            db.Members.remove({_id: mid}, this.parallel());
          }
        );
      },
      function (err) {
        if (com.error(err, req, res)) return;
        req.logOut();
        delete req.session.referer;
        res.send({deleted: true});
      }
    );
  });

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
    passport.authenticate('facebook', {scope: ['email', 'user_photos',
        'publish_stream']})(req, res, next);
  });

  // Facebook returns here
  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', function (err, member, info) {
      if (err) return next(err);
      if (!member)
        return res.redirect('/');
      if (!member.password) {
        req.session.temp = {provider: 'facebook', member: member};
        return res.redirect('/');
      }
      req.logIn(member, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next); 
  });

  // Facebook authorization
  app.get('/connect/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook-authz']._callbackURL = returnUrl;
    passport.authorize('facebook-authz', {scope: ['email', 'user_photos',
        'publish_stream']})(req, res, next);
  });

  // Facebook authorization returns here
  app.get('/connect/facebook/callback', function (req, res, next) {
    passport.authorize('facebook-authz', function (err, member, info) {
      if (err) return next(err);
      if (!info) return res.redirect(req.session.referer || '/');
      info.modified = true;
      db.Members.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Twitter authentication
  app.get('/auth/twitter', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
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
        return res.redirect('/');
      if (!member.password) {
        req.session.temp = {provider: 'twitter', member: member};
        return res.redirect('/');
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
      if (!info) return res.redirect(req.session.referer || '/');
      info.modified = true;
      db.Members.update({_id: req.user._id}, {$set: info}, function (err) {
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
      if (!info) return res.redirect(req.session.referer || '/');
      info.modified = true;
      db.Members.update({_id: req.user._id}, {$set: info}, function (err) {
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

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
}
