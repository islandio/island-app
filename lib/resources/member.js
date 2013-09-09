/*
 * member.js: Handling for the member resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var request = require('request');
var curl = require('curlrequest');
var url = require('url');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;
var InstagramStrategy = require('passport-instagram').Strategy;
var db = require('../db.js');
var com = require('../common.js');
var search;

/* e.g.,
  {
    "_id" : <ObjectId>,
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
    "confirmed" : <Boolean>,
    "provider": <String>,
    "facebook" : <String>,
    "facebookId" : <String>,
    "facebookToken" : <String>,
    "twitter": <String>,
    "twitterId" : <String>,
    "twitterToken" : <String>,
    "instagram" : <String>,
    "instagramId" : <String>,
    "instagramToken" : <String>,
    "image" : <Object>,
    "gender" : <String>,
    "hometown" : {
      "name" : <String>,
      "city" : <String>,
      "state" : <String>,
      "country" : <String>,
      "latitude" : <Number>,
      "longitude" : <Number>
    },
    "location" : {
      "name" : <String>,
      "latitude" : <Number>,
      "longitude" : <Number>
    },
    "website": <String>,
    "created" : <ISODate>,
    "updated" : <ISODate>
  }
*/

var BLACKLIST = [
  'island',
  'climb',
  'team',
  'films',
  'contact',
  'about',
  'settings',
  'privacy',
  'reset',
  'logout',
  'crags',
  'ascents',
  'service',
  'api',
  'user',
  'member',
];

/*
 * Make salt for a password.
 */
function makeSalt() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
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
function parseDisplayName(displayName) {
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

/*
 * Index member for search.
 */
function indexMember(member) {
  if (member.displayName && member.displayName !== ''
      && member.displayName.match(/\w+/g))
    search.index(member.displayName, member._id.toString());
  if (member.username.match(/\w+/g))
    search.index(member.username, member._id.toString());
}

// Do any initializations
exports.init = function (app) {
  search = app.get('reds').createSearch('members');

  //
  // Passport auth/authz
  //

  // Serialize members (users) for requests.
  passport.serializeUser(function (member, cb) {
    cb(null, member._id.toString());
  });

  // De-serialize members (users) for requests.
  passport.deserializeUser(function (id, cb) {
    db.Members.read({_id: db.oid(id)}, function (err, member) {
      if (err) return cb(err);
      if (!member) return cb(null, null);
      delete member.password;
      delete member.salt;
      member.gravatar = com.hash(member.primaryEmail || 'foo@bar.baz');
      cb(null, member);
    });
  });
  
  // Facebook authenticate
  passport.use(new FacebookStrategy(app.get('facebook'),
      function (token, refresh, props, cb) {

    // Find existing member.
    db.Members.read({facebookId: props.id}, function (err, member) {
      if (err) return cb(err);

      if (!member) {

        // Grab useful info from the profile.
        props.facebookToken = token;
        props.facebookRefresh = refresh;
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.facebookId = props.id;

        // Delete everything else.
        delete props.id;
        delete props.profileUrl;
        delete props._raw;
        delete props._json;

        // Setup new member object.
        _.defaults(props, {
          config: {
            notifications: {
              comment: {
                email: true
              }
            }
          },
          role: 1
        });
        if (props.emails.length > 0)
          props.primaryEmail = props.emails[0].value;
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new member.
        db.Members.create(props, {force: {username: 1}},
            function (err, member) {
          if (err) return cb(err);

          // Index.
          indexMember(member);

          // Done.
          cb(null, member);
        });
        return;
      }

      // Member exists. Update auth info.
      var update = {
        facebookToken: token,
        facebookRefresh: refresh
      };
      db.Members.update({_id: member._id}, {$set: update}, function (err) {
        if (err) return cb(err);
        cb(null, _.extend(member, update));
      });
    });
  }));
  
  // Facebook authorize
  passport.use('facebook-authz', new FacebookStrategy(app.get('facebook'),
    function (token, refresh, profile, cb) {
      db.Members.read({facebookId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          facebookToken: token,
          facebookRefresh: refresh,
          facebookId: profile.id,
          facebook: profile.username,
        });
      });
    }
  ));
  
  // Twitter authenticate
  passport.use(new TwitterStrategy(app.get('twitter'),
      function (token, secret, props, cb) {

    // Find existing member.
    db.Members.read({twitterId: props.id}, function (err, member) {
      if (err) return cb(err);
      
      if (!member) {

        // Grab useful info from the profile.
        props.twitterToken = token;
        props.twitterSecret = secret;
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.twitterId = props.id;

        // Delete everything else.
        delete props.id;
        delete props.profileUrl;
        delete props._raw;
        delete props._json;

        // Setup new member object.
        _.defaults(props, {
          config: {
            notifications: {
              comment: {
                email: false
              }
            }
          },
          role: 1
        });
        if (props.emails.length > 0)
          props.primaryEmail = props.emails[0].value;
        if (!props.username)
          props.username = props.displayName && props.displayName !== '' ?
              _.slugify(props.displayName): com.key();

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username))
          props.username = com.key();

        // Create a new member.
        db.Members.create(props, {force: {username: 1}},
            function (err, member) {
          if (err) return cb(err);

          // Index.
          indexMember(member);

          // Done.
          cb(null, member);
        });
        return;
      }

      // Member exists. Update auth info.
      var update = {
        twitterToken: token,
        twitterSecret: secret
      };
      db.Members.update({_id: member._id}, {$set: update}, function (err) {
        if (err) return cb(err);
        cb(null, _.extend(member, update));
      });
    });
  }));
  
  // Twitter authorize
  passport.use('twitter-authz', new TwitterStrategy(app.get('twitter'),
    function (token, secret, profile, cb) {
      db.Members.read({twitterId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          twitterToken: token,
          twitterSecret: secret,
          twitterId: profile.id,
          twitter: profile.username,
        });
      });
    }
  ));

  // Instagram authorize
  passport.use('instagram-authz', new InstagramStrategy(app.get('instagram'),
    function (token, refresh, profile, cb) {
      db.Members.read({instagramId: profile.id},
          function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          instagramToken: token,
          instagramRefresh: refresh,
          instagramId: profile.id,
          instagram: profile.username,
        });
      });
    }
  ));

  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');
  var mailer = app.get('mailer');

  // Facebook authentication
  app.get('/auth/facebook', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer) : {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/facebook/callback';
    var returnUrl = url.format(referer);
    passport._strategies['facebook']._callbackURL = returnUrl;
    passport.authenticate('facebook', {scope: ['email',
        'publish_stream']})(req, res, next);
  });

  // Facebook returns here
  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', function (err, member, info) {
      if (err) return next(err);
      if (!member) return res.redirect('/');
      
      // Login.
      req.login(member, function (err) {
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
    passport.authorize('facebook-authz', {scope: ['email',
        'publish_stream']})(req, res, next);
  });

  // Facebook authorization returns here
  app.get('/connect/facebook/callback', function (req, res, next) {
    passport.authorize('facebook-authz', function (err, member, info) {
      if (err) return next(err);
      if (!info) return res.redirect(req.session.referer || '/');
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
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/twitter/callback';
    var returnUrl = url.format(referer);
    passport._strategies['twitter']._oauth._authorize_callback = returnUrl;
    passport.authenticate('twitter')(req, res, next);
  });

  // Twitter authentication returns here
  app.get('/auth/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', function (err, member, info) {
      if (err) return next(err);
      if (!member) return res.redirect('/');
      
      // Login.
      req.login(member, function (err) {
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
      db.Members.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        var url = (req.session.referer || '/') + '?tip=insta'
        res.redirect(url);
      });
    })(req, res, next);
  });

  // List
  app.post('/api/members/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};
    var sort = req.body.sort || {created: -1};

    db.Members.list(query, {sort: sort, limit: limit,
        skip: limit * cursor},
        function (err, mems) {
      if (com.error(err, req, res)) return;

      // Clean up.
      _.each(mems, function (mem) {
        delete mem.password;
        delete mem.salt;
        mem.gravatar = com.hash(mem.primaryEmail || 'foo@bar.baz');
      });

      // Send profile.
      res.send(com.client({
        profiles: {
          cursor: ++cursor,
          more: mems && mems.length === limit,
          items: mems,
          query: query,
          sort: sort,
        }
      }));

    });
  });

  // Create
  app.post('/api/members', function (req, res) {
    if (!req.body || !req.body.newusername || !req.body.newemail
        || !req.body.newpassword)
      return res.send(403, {error: 'Member invalid'});

    // Check details.
    req.body.newusername = _.slugify(req.body.newusername).substr(0, 30);
    if (req.body.newusername.length < 4)
      return res.send(403, {error: 'Username too short'});
    if (req.body.newpassword.length < 7)
      return res.send(403, {error: 'Password too short'});

    // Check blacklist.
    if (_.contains(BLACKLIST, req.body.newusername))
      return res.send(403, {error: 'Username exists'});

    // Setup new member object.
    var props = {
      provider: 'local',
      username: req.body.newusername,
      displayName: req.body.newusername,
      emails: [{value: req.body.newemail}],
      primaryEmail: req.body.newemail,
      salt: makeSalt(),
      password: req.body.newpassword,
      config: {
        notifications: {
          comment: {
            email: true
          }
        }
      },
      role: 1
    };

    // Handle password.
    props.password = com.encrypt(props.password, props.salt);

    // Attempt to create a new member.
    db.Members.create(props, function (err, member) {
      if (err && err.code === 11000) {
        if (err.err.indexOf('username') !== -1)
          return res.send(403, {error: 'Username exists'});
        else if (err.err.indexOf('primaryEmail') !== -1)
          return res.send(403, {error: 'Email address exists'});
        else
          return res.send(403, {error: 'Unknown duplicate'});
      }
      if (com.error(err, req, res)) return;

      // Index.
      indexMember(member);

      // Login.
      req.login(member, function (err) {
        if (com.error(err, req, res)) return;
        res.send({created: true});
      });
    });
  });

  // Read
  app.get('/api/members/:un', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, doc) {
      if (com.error(err, req, res, doc, 'member')) return;
      delete doc.password;
      delete doc.salt;
      delete doc.emails;
      delete doc.primaryEmail;
      delete doc.facebookToken;
      delete doc.facebookRefresh;
      delete doc.twitterToken;
      delete doc.twitterSecret;
      delete doc.instagramToken;
      delete doc.instagramRefresh;
      res.send(doc);
    });

  });

  // Update
  app.put('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'Member invalid'});

    // Check details.
    var props = req.body;
    if (props.username)
      props.username = _.slugify(props.username).substr(0, 30);
    if (props.username !== undefined && props.username.length < 4)
      return res.send(403, {error: 'Username too short'});

    // Check blacklist.
    if (props.username && _.contains(BLACKLIST, props.username))
      return res.send(403, {error: 'Username exists'});

    // Ensure displayName is not empty.
    if (props.displayName !== undefined && props.displayName.length < 4)
      return res.send(403, {error: 'Name too short'});

    // Check for image.
    if (props.assembly) {
      props.image = props.assembly.results.image_full[0];
      props.image.cf_url = app.get('cloudfront').img
          + props.image.id.substr(0, 2) + '/' + props.image.id.substr(2)
          + '.' + props.image.ext;
      delete props.assembly;
    }
    if (props.bannerLeft) {
      props['image.meta.left'] = props.bannerLeft * 640 / 480;
      delete props.bannerLeft;
    }
    if (props.bannerTop) {
      props['image.meta.top'] = props.bannerTop * 640 / 480;
      delete props.bannerTop;
    }

    // Skip if nothing to do.
    if (_.isEmpty(props))
      return res.send(403, {error: 'Member empty'});

    // Do the update.
    db.Members.update({username: req.params.un}, {$set: props},
        function (err, stat) {
      if (err && err.code === 11001) {
        if (err.err.indexOf('username') !== -1)
          return res.send(403, {error: 'Username exists'});
        else if (err.err.indexOf('primaryEmail') !== -1)
          return res.send(403, {error: 'Email address exists'});
        else
          return res.send(403, {error: 'Unknown duplicate'});
      }
      if (com.error(err, req, res, stat, 'member')) return;

      Step(
        function () {

          // Get the member if needed.
          if (!props.username && !props.displayName) return this();
          db.Members.read({username: props.username || req.params.un}, this);

        },
        function (err, member) {
          if (com.error(err, req, res)) return;

          // Index.
          if (member) {
            search.remove(member._id);
            indexMember(member);
          }

          res.send({updated: true});
        }
      );

    });

  });

  // Delete
  app.delete('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un)
      return res.send(403, {error: 'Member invalid'});

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
            if (posts.length === 0) return this();
            var next = _.after(posts.length, this);
            _.each(posts, function (p) {
              db.Events.list({target_id: p._id}, function (err, events) {
                if (events.length === 0) return next();
                var _next = _.after(events.length, next);
                _.each(events, function (e) {
                  db.Notifications.list({event_id: e._id},
                      function (err, notes) {

                    // Publish removed statuses.
                    _.each(notes, function (note) {
                      pubsub.publish('mem-' + note.subscriber_id.toString(),
                          'notification.removed', {id: note._id.toString()});
                    });
                  });
                  db.Notifications.remove({event_id: e._id}, _next);
                });
              });
            });
          },
          function (err) {
            if (err) return this(err);
            var parallel = this.parallel;

            // Remove others' content on member's posts.
            _.each(posts, function (p) {

              // Publish removed status.
              pubsub.publish('posts', 'post.removed', {id: p._id.toString()});

              db.Comments.remove({parent_id: p._id}, parallel());
              db.Subscriptions.remove({subscribee_id: p._id}, parallel());
              db.Events.remove({target_id: p._id}, parallel());
            });

            // Remove member's content.
            db.Posts.remove({author_id: mid}, parallel());
            db.Medias.remove({author_id: mid}, parallel());
            db.Comments.remove({author_id: mid}, parallel());
            db.Subscriptions.remove({$or: [{subscriber_id: mid},
                {subscribee_id: mid}]}, parallel());
            _.each(events, function (e) {
              db.Notifications.list({event_id: e._id},
                  function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {id: note._id.toString()});
                });
              });
              db.Notifications.remove({event_id: e._id}, parallel());
            });
            db.Events.remove({actor_id: mid}, parallel());

            // Finally, remove the member.
            db.Members.remove({_id: mid}, parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;
            
            // Logout.
            req.logout();
            delete req.session.referer;
            res.send({removed: true});
          }
        );
      }
    );
  });

  // Auth
  app.post('/api/members/auth', function (req, res) {
    if (!req.body || !req.body.username || !req.body.password)
      return res.send(403, {error: 'Member invalid'});

    // Find member.
    db.Members.read({$or: [{username: req.body.username},
          {primaryEmail: req.body.username}]}, function (err, member) {
      if (com.error(err, req, res)) return;

      // Check password.
      if (!member || !member.password
          || com.encrypt(req.body.password, member.salt) !== member.password)
        return res.send(401, {error: 'Invalid credentials'});

      // Login.
      req.login(member, function (err) {
        if (com.error(err, req, res)) return;
        res.send({authenticated: true});
      });

    });
  });

  // Forgot
  app.post('/api/members/forgot', function (req, res) {
    if (!req.body || !req.body.email)
      return res.send(403, {error: 'Member invalid'});

    // Find member.
    db.Members.read({primaryEmail: req.body.email}, function (err, member) {
      if (com.error(err, req, res, member, 'member')) return;

      if (!member.password)
        return res.send(403, {error: 'No password',
            data: {provider: member.provider}});

      // Send the email.
      mailer.reset(member, function (err) {
        if (com.error(err, req, res)) return;
        res.send({found: true});
      });

    });

  });

  // Reset
  app.post('/api/members/reset', function (req, res) {
    if (!req.body || !req.body.newpassword || !req.body.cnewpassword)
      return res.send(403, {error: 'Member invalid'});

    // Check length
    if (req.body.newpassword.length < 7)
      return res.send(403, {error: 'Password too short'});

    // Compare new passwords.
    if (req.body.newpassword !== req.body.cnewpassword)
      return res.send(403, {error: 'Passwords do not match'});

    // Make new password.
    var props = {salt: makeSalt()};
    props.password = com.encrypt(req.body.newpassword, props.salt);

    // Check for user.
    if (req.user)

      // Get the member.
      db.Members.read({_id: req.user._id}, function (err, member) {
        if (com.error(err, req, res, member, 'member')) return;

        // Check old password.
        if (!member.password || !req.body.oldpassword
            || com.encrypt(req.body.oldpassword, member.salt) !== member.password)
          return res.send(401, {error: 'Invalid credentials'});
        else update(member._id)
      });
    
    // Check for session token.
    else if (req.session.reset_token)
      db.Keys.read({_id: db.oid(req.session.reset_token)}, function (err, key) {
        if (com.error(err, req, res, key, 'key')) return;
        delete req.session.reset_token;
        update(key.member_id);
      });
    else
      return res.send(403, {error: 'Password reset session invalid'});

    // Do the update.
    function update(_id) {
      db.Members.update({_id: _id}, {$set: props},
          function (err, stat) {
        if (com.error(err, req, res, stat, 'member')) return;

        // All done.
        res.send({updated: true});
      });
    }
  });

  // Search
  app.post('/api/members/search/:s', function (req, res) {

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {

      Step(
        function () {

          // Check results.
          if (ids.length === 0) return this();

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching posts.
          db.Members.list({_id: {$in: _ids}}, {sort: {created: 1},
              limit: 20}, this);

        },
        function (err, mems) {
          if (com.error(err, req, res)) return;
          var filtered = [];
          _.each(mems, function (m) {
            filtered.push({
              username: m.username,
              displayName: m.displayName,
              gravatar: com.hash(m.primaryEmail || 'foo@bar.baz'),
            });
          });

          // Send profile.
          res.send(com.client({items: filtered}));

        }
      );
      
    });

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (app) {
  var pubsub = app.get('pubsub');

  function instagrams() {

    // Format strings for SQL.
    function clean(str) { return str.replace(/'/g, "''"); }

    // Get all members that have an instagram handle.
    db.Members.list({instagramId: {$exists: true}}, function (err, members) {
      if (err) return util.error(err);
      if (members.length === 0) return;
      var now = Math.floor(Date.now() / 1000) - (10*60);

      Step(
        function () {
          var group = this.group();

          // Get the members' recent Instagrams.
          _.each(members, function (m) {
            (function fetch(cb) {
              request.get({
                uri: 'https://api.instagram.com/v1/users/' + m.instagramId
                    + '/media/recent',
                qs: {
                  access_token: m.instagramToken,
                  min_timestamp: now
                }
              }, function (err, response, body) {
                if (err) return cb(err);
                if (response.statusCode !== 200)
                  return cb(body);
                cb(null, _.map(JSON.parse(body).data, function (g) {
                  g.mid = m._id.toString();
                  g.name = m.displayName;
                  g.username = m.username;
                  return g;
                }));
              });
            })(group());
          });

        },
        function (err, grams) {
          if (err || !grams || grams.length === 0) return this();

          // Filter the instagrams for the correct tag(s).
          grams = _.filter(_.flatten(grams), function (g) {
              return _.include(g.tags, 'island'); });
          if (grams.length === 0) return this();
          util.log('Got ' + grams.length + ' Instagram'
              + (grams.length === 1 ? '': 's'));

          // Map the images to CartoDB.
          var names = ["the_geom", "id", "mid", "name",
              "username", "handle", "caption", "uri", "turi"];
          var query = "INSERT INTO instagrams ("
              + _.join(",", names) + ") VALUES ";
          var cnt = grams.length;
          _.each(grams, function (g, i) {
            if (!g.location) {
              util.log('Cannot locate instagram: ');
              util.log(util.inspect(g));
              return --cnt;
            }
            query += "(" + _.join(",", [g.location.latitude 
                && g.location.longitude ?
                "CDB_LatLng(" + g.location.latitude + ","
                + g.location.longitude + ")": "NULL",
                "'" + g.id + "'", "'" + g.mid + "'",
                "'" + g.name + "'", "'" + g.username + "'",
                "'" + g.user.username + "'",
                g.caption ? "'" + clean(g.caption.text) + "'": 'NULL',
                "'" + g.images.standard_resolution.url + "'",
                "'" + g.images.thumbnail.url + "'"]) + ")";
            if (i !== grams.length - 1) query += ", ";
          });
          if (cnt === 0) return;

          // Call up the CartoDB API.
          curl.request({
            url: 'https://' + app.get('cartodb').user
                + '.cartodb.com/api/v2/sql',
            method: 'POST',
            data: {q: query, api_key: app.get('cartodb').api_key}
          }, this);
          
        },
        function (err, data) {
          if (err) return util.error(err);
          if (data) {
            data = JSON.parse(data);
            if (data.error) return util.error(data.error);
            util.log('Mapped Instagram(s)');
            
            // Publish comment.
            pubsub.publish('map', 'instagram.new');
          }
        }
      );

    });

  };

  // Run instagram check every minute.
  new Job('1 * * * * *', instagrams, function () {}, true,
      'America/Los_Angeles');
  instagrams();
  util.log('Instagram job started');

  return exports;
}
