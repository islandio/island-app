/*
 * member.js: Handling for the member resource.
 *
 */

// Module Dependencies
var url = require('url');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var InstagramStrategy = require('passport-instagram').Strategy;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "username": <String>,
    "password": <String>,
    "salt": <String>,
    "role": <Number>,
    "primaryEmail": <String>,
    "emails": [
      {
        "value" : <String>
      }
    ],
    "displayName": <String>,
    "name": {
      "familyName": <String>,
      "givenName": <String>,
      "middleName": <String>
    },
    "description": <String>,
    "team_ids": [<ObjectId>],
    "config": {
      "notifications": {
        "comment": {
          "email": <Boolean>
        }
      },
      "privacy": {
        "enhanced": <Boolean>
      }
    },
    "confirmed": <Boolean>,
    "provider": <String>,
    "facebook": <String>,
    "facebookId": <String>,
    "facebookToken": <String>,
    "twitter": <String>,
    "twitterId": <String>,
    "twitterToken": <String>,
    "instagram": <String>,
    "instagramId": <String>,
    "instagramToken": <String>,
    "googleId" : <String>,
    "googleToken" : <String>,
    "googleRefresh" : <String>,
    "image": <Object>,
    "gender": <String>,
    "hometown": {
      "name": <String>,
      "city": <String>,
      "state": <String>,
      "country": <String>,
      "latitude": <Number>,
      "longitude": <Number>
    },
    "location": {
      "name": <String>,
      "latitude": <Number>,
      "longitude": <Number>
    },
    "website": <String>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

var BLACKLIST = [
  'auth',
  'connect',
  'data',
  'library',
  'streams',
  'stream',
  'public',
  'private',
  'home',
  'how',
  'clear',
  'trending',
  'mission',
  'chart',
  'embed',
  'upload',
  'island',
  'climb',
  'climber',
  'climbing',
  'boulder',
  'bouldering',
  'boulderer',
  'team',
  'films',
  'contact',
  'about',
  'settings',
  'privacy',
  'reset',
  'logout',
  'login',
  'signin',
  'signup',
  'crag',
  'crags',
  'ascent',
  'ascents',
  'service',
  'api',
  'user',
  'users',
  'username',
  'member',
  'members',
  'post',
  'posts',
  'session',
  'sessions',
  'tick',
  'ticks',
  'log',
  'logs',
  'effort',
  'efforts'
];

var DEFUALT_CONFIG = {
  notifications: {
    comment: {
      email: true
    },
    hangten: {
      email: true
    },
    follow: {
      email: true
    },
    request: {
      email: true
    },
    accept: {
      email: true
    },
  },
  privacy: {
    mode: 0,
    ticks: 0
  }
};

/*
 * Index member for search.
 */
function indexMember(m) {
  app.get('cache').index('members', m, ['username', 'displayName']);
}

/*
 * Subscribe member to the island user.
 */
function subscribeToIsland(member, cb) {
  if (member.username === 'island') {
    return cb();
  }
  var db = app.get('db');
  var events = app.get('events');

  db.Members.read({username: 'island'}, function (err, island) {
    if (err) return cb(err);

    Step(
      function () {
        if (island) {
          return this(null, island);
        }

        // Create the island user.
        createMember({username: 'island', displayName: 'The Island',
            email: 'admin@island.io', password: 'weare1s1and'}, true, this);
      },
      function (err, island) {
        if (err) return this(err);

        // Create subscription.
        events.subscribe(member, island, {style: 'follow',
            type: 'member'}, function (err, sub) {
          if (err) return cb(err);
          if (!sub) {
            return cb('Could not subscribe to the island user');
          }
          cb();
        });
      }
    );
  });
}

/*
 * Create local member.
 */
var createMember = exports.createMember = function(memberProps, force, cb) {
  if (typeof force === 'function') {
    cb = force;
    force = false;
  }
  var db = app.get('db');

  if (!memberProps || !memberProps.username || !memberProps.email
      || !memberProps.password) {
    return cb({message: 'Member invalid'});
  }

  // Check details.
  memberProps.username = iutil.toUsername(memberProps.username);
  if (memberProps.username.length < 4) {
    return cb({message: 'Username too short'});
  }
  if (memberProps.password.length < 7) {
    return cb({message: 'Password too short'});
  }

  // Check blacklist.
  if (!force && _.contains(BLACKLIST, memberProps.username)) {
    return cb({message: 'Username exists'});
  }

  // Setup new member object.
  var props = {
    provider: 'local',
    username: memberProps.username,
    displayName: memberProps.displayName || memberProps.username,
    emails: [{value: memberProps.email}],
    primaryEmail: memberProps.email,
    salt: iutil.salt(),
    password: memberProps.password,
    config: DEFUALT_CONFIG,
    role: 1
  };

  // Handle password.
  props.password = iutil.encrypt(props.password, props.salt);

  // Attempt to create a new member.
  db.Members.create(props, function (err, member) {
    if (err && err.code === 11000) {
      if (err.err.indexOf('username') !== -1) {
        return cb({message: 'Username exists'});
      } else if (err.err.indexOf('primaryEmail') !== -1) {
        return cb({message: 'Email address exists'});
      } else {
        return cb({message: 'Unknown duplicate'});
      }
    }
    if (err) return cb(err);

    // Index.
    indexMember(member);


    // Sub member to the island user.
    subscribeToIsland(member, function (err) {
      cb(err, member);
    });
  });
};

// Init resource.
exports.init = function () {
  var db = app.get('db');

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
      member.gravatar = iutil.hash(member.primaryEmail || 'foo@bar.baz');
      cb(null, member);
    });
  });
  
  // Facebook authenticate
  passport.use(new FacebookStrategy({
      name: app.get('FACEBOOK_NAME'),
      clientID: app.get('FACEBOOK_CLIENT_ID'),
      clientSecret: app.get('FACEBOOK_CLIENT_SECRET')
    }, function (token, refresh, props, cb) {

    // Find existing member.
    var email = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    if (email) {
      props.primaryEmail = email;
    }
    var query = {$or: [{facebookId: props.id}]};
    if (props.primaryEmail) {
      query.$or.push({primaryEmail: props.primaryEmail});
    }
    db.Members.read(query, function (err, member) {
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
          provider: 'facebook',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username) {
          props.username = props.displayName && props.displayName !== '' ?
              iutil.toUsername(props.displayName): iutil.key();
        }

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username)) {
          props.username = iutil.key();
        }

        // Create a new member.
        db.Members.create(props, {force: {username: 1}},
            function (err, member) {
          if (err) return cb(err);

          // Index.
          indexMember(member);

          // Sub user to the island user.
          subscribeToIsland(member, function (err) {
            cb(err, member);
          });
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
  passport.use('facebook-authz', new FacebookStrategy({
      name: app.get('FACEBOOK_NAME'),
      clientID: app.get('FACEBOOK_CLIENT_ID'),
      clientSecret: app.get('FACEBOOK_CLIENT_SECRET')
    }, function (token, refresh, profile, cb) {
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
  passport.use(new TwitterStrategy({
      consumerKey: app.get('TWITTER_CONSUMER_KEY'),
      consumerSecret: app.get('TWITTER_CONSUMER_SECRET')
    }, function (token, secret, props, cb) {

    // Find existing member.
    var email = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    if (email) {
      props.primaryEmail = email;
    }
    var query = {$or: [{twitterId: props.id}]};
    if (props.primaryEmail) {
      query.$or.push({primaryEmail: props.primaryEmail});
    }
    db.Members.read(query, function (err, member) {
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
          provider: 'twitter',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username) {
          props.username = props.displayName && props.displayName !== '' ?
              iutil.toUsername(props.displayName): iutil.key();
        }

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username)) {
          props.username = iutil.key();
        }

        // Create a new member.
        db.Members.create(props, {force: {username: 1}},
            function (err, member) {
          if (err) return cb(err);

          // Index.
          indexMember(member);

          // Sub user to the island user.
          subscribeToIsland(member, function (err) {
            cb(err, member);
          });
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
  passport.use('twitter-authz', new TwitterStrategy({
      consumerKey: app.get('TWITTER_CONSUMER_KEY'),
      consumerSecret: app.get('TWITTER_CONSUMER_SECRET')
    }, function (token, secret, profile, cb) {
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

  // Google authenticate
  passport.use(new GoogleStrategy({
    clientID: app.get('GOOGLE_CLIENT_ID'),
    clientSecret: app.get('GOOGLE_CLIENT_SECRET')
  }, function (access, refresh, props, cb) {

    // Find existing member.
    var email = props.emails && props.emails.length > 0 ?
        props.emails[0].value: null;
    if (email) {
      props.primaryEmail = email;
    }
    var query = {$or: [{googleId: props.id}]};
    if (props.primaryEmail) {
      query.$or.push({primaryEmail: props.primaryEmail});
    }
    db.Members.read(query, function (err, member) {
      if (err) return cb(err);

      if (!member) {

        // Grab useful info from the profile.
        props.googleToken = access;
        props.googleRefresh = refresh;
        props.emails = props.emails ?
            _.filter(props.emails, function (e) {
            return e !== null; }) : [];
        props.googleId = props.id;

        // Delete everything else.
        delete props.id;
        delete props.profileUrl;
        delete props._raw;
        delete props._json;

        // Setup new member object.
        _.defaults(props, {
          provider: 'google',
          config: DEFUALT_CONFIG,
          role: 1
        });
        if (!props.username) {
          props.username = props.displayName && props.displayName !== '' ?
              iutil.toUsername(props.displayName): iutil.key();
        }

        // Check blacklist.
        if (_.contains(BLACKLIST, props.username)) {
          props.username = iutil.key();
        }

        // Create a new member.
        db.Members.create(props, {force: {username: 1}},
            function (err, member) {
          if (err) return cb(err);

          // Index.
          indexMember(member);

          // Sub user to the island user.
          subscribeToIsland(member, function (err) {
            cb(err, member);
          });
        });
        return;
      }

      // User exists. Update auth info.
      var update = {
        googleToken: access,
        googleRefresh: refresh
      };
      db.Users.update({_id: user._id}, {$set: update}, function (err) {
        if (err) return cb(err);
        cb(null, _.extend(user, update));
      });
    });
  }));

  // Google authorize
  passport.use('google-authz', new GoogleStrategy({
    clientID: app.get('GOOGLE_CLIENT_ID'),
    clientSecret: app.get('GOOGLE_CLIENT_SECRET')
  }, function (access, refresh, props, cb) {
      db.Users.read({googleId: id}, function (err, member) {
        if (err) return cb(err);
        cb(null, member, {
          googleToken: access,
          googleRefresh: refresh,
          googleId: props.id
        });
      });
    }
  ));

  // Instagram authorize
  passport.use('instagram-authz', new InstagramStrategy({
      clientID: app.get('INSTAGRAM_CLIENT_ID'),
      clientSecret: app.get('INSTAGRAM_CLIENT_SECRET'),
      callbackURL: app.get('HOME_URI') + app.get('INSTAGRAM_CALLBACK_URL'),
      verifyToken: app.get('INSTAGRAM_VERIFY_TOKEN')
    }, function (token, refresh, profile, cb) {
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

  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var events = app.get('events');
  var cache = app.get('cache');
  var emailer = app.get('emailer');
  var errorHandler = app.get('errorHandler');

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
      if (!member) {
        return res.redirect('/');
      }
      
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
      if (!info) {
        return res.redirect(req.session.referer || '/');
      }
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
      if (!member) {
        return res.redirect('/');
      }
      
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
      if (!info) {
        return res.redirect(req.session.referer || '/');
      }
      db.Members.update({_id: req.user._id}, {$set: info}, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Google authentication
  app.get('/auth/google', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/auth/google/return';
    var returnUrl = url.format(referer);
    passport._strategies['google']._callbackURL = returnUrl;
    passport.authenticate('google', {scope: ['profile',
        'email']})(req, res, next);
  });

  // Google authentication returns here
  app.get('/auth/google/return', function (req, res, next) {
    passport.authenticate('google', function (err, member, info) {
      if (err) return next(err);
      if (!member) {
        return res.redirect('/');
      }
      
      // Login.
      req.login(member, function (err) {
        if (err) return next(err);
        res.redirect(req.session.referer || '/');
      });
    })(req, res, next);
  });

  // Google authorization
  app.get('/connect/google', function (req, res, next) {
    var referer = req.headers.referer ? url.parse(req.headers.referer): {};
    referer.search = referer.query = referer.hash = null;
    req.session.referer = url.format(referer);
    referer.pathname = '/connect/google/return';
    var returnUrl = url.format(referer);
    passport._strategies['google']._callbackURL = returnUrl;
    passport.authorize('google', {scope: ['profile',
        'email']})(req, res, next);
  });

  // Google authorization returns here
  app.get('/connect/google/return', function (req, res, next) {
    passport.authorize('google-authz', function (err, member, info) {
      if (err) return next(err);
      if (!info) {
        return res.redirect(req.session.referer || '/');
      }
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
      if (!info) {
        return res.redirect(req.session.referer || '/');
      }
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
      if (errorHandler(err, req, res)) return;

      // Clean up.
      _.each(mems, function (mem) {
        delete mem.password;
        delete mem.salt;
        mem.gravatar = iutil.hash(mem.primaryEmail || 'foo@bar.baz');
      });

      // Send profile.
      res.send(iutil.client({
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
    createMember(req.body, function(err, member) {
      if (err) {
        res.send(403, {error: err});
      } else {
        // Login.
        req.login(member, function (err) {
          if (errorHandler(err, req, res)) return;
          res.send({created: true});
        });
      }
    });
  });

  // Read
  app.get('/api/members/:un', function (req, res) {

    // Get the member.
    db.Members.read({username: req.params.un}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'member')) return;
      delete doc.password;
      delete doc.salt;
      delete doc.emails;
      delete doc.primaryEmail;
      delete doc.facebookToken;
      delete doc.facebookRefresh;
      delete doc.twitterToken;
      delete doc.twitterSecret;
      delete doc.googleToken;
      delete doc.googleRefresh;
      delete doc.instagramToken;
      delete doc.instagramRefresh;
      res.send(doc);
    });

  });

  // Update
  app.put('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Check details.
    var props = req.body;
    if (props.username) {
      props.username = iutil.toUsername(props.username);
    }
    if (props.username !== undefined && props.username.length < 4) {
      return res.send(403, {error: {message: 'Username too short'}});
    }

    // Check blacklist.
    if (props.username && _.contains(BLACKLIST, props.username)) {
      return res.send(403, {error: {message: 'Username exists'}});
    }

    // Ensure displayName is not empty.
    if (props.displayName !== undefined && props.displayName.length < 4) {
      return res.send(403, {error: {message: 'Name too short'}});
    }

    // Check for image.
    if (props.assembly) {
      props.image = props.assembly.results.image_full[0];
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
    if (_.isEmpty(props)) {
      return res.send(403, {error: {message: 'Member empty'}});
    }

    // Do the update.
    db.Members.update({username: req.params.un}, {$set: props},
        function (err, stat) {
      if (err && err.code === 11001) {
        if (err.err.indexOf('username') !== -1) {
          return res.send(403, {error: {message: 'Username exists'}});
        } else if (err.err.indexOf('primaryEmail') !== -1) {
          return res.send(403, {error: {message: 'Email address exists'}});
        } else {
          return res.send(403, {error: {message: 'Unknown duplicate'}});
        }
      }
      if (errorHandler(err, req, res, stat, 'member')) return;

      Step(
        function () {

          // Get the member if needed.
          if (!props.username && !props.displayName) {
            return this();
          }
          db.Members.read({_id: req.user._id}, this);

        },
        function (err, member) {
          if (errorHandler(err, req, res)) return;

          // Index.
          if (member) {
            indexMember(member);
          }

          res.send({updated: true});
        }
      );

    });

  });

  // Delete
  /*
    Need to remove
    - notifications generated by the member's content
    - other member's content on the member's content
    - the member's content (not crags or ascents)
    - the member
  */
  app.delete('/api/members/:un', function (req, res) {
    if (!req.user || req.user.username !== req.params.un) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }
    var mid = req.user._id;

    function _deleteResource(type, cb) {
      db[_.capitalize(type) + 's'].list({author_id: mid}, function (err, docs) {
        if (err) return cb(err);
        if (docs.length === 0) {
          return cb();
        }

        Step(
          function () {
            // Handle each doc.
            _.each(docs, _.bind(function (d) {

              // Handle events and notifications.
              (function (cb) {
                Step(
                  function () {
                    // Get all related events.
                    db.Events.list({$or: [{target_id: d._id}, {action_id: d._id}]}, this);
                  },
                  function (err, es) {
                    if (err) return this(err);
                    if (es.length === 0) {
                      return this();
                    }
                    var _this = _.after(es.length, this);
                    _.each(es, function (e) {

                      // Publish removed status.
                      events.publish('event', 'event.removed', {data: e});

                      // Get any related notifications.
                      db.Notifications.list({event_id: e._id},
                          function (err, notes) {
                        if (err) return _this(err);

                        // Publish removed statuses.
                        _.each(notes, function (note) {
                          events.publish('mem-' + note.subscriber_id.toString(),
                              'notification.removed', {data: {id: note._id.toString()}});
                        });

                        // Bulk remove notifications.
                        db.Notifications.remove({event_id: e._id}, _this);
                      });
                    });
                  },
                  function (err) {
                    if (err) return this(err);

                    // Bulk remove all related events.
                    db.Events.remove({$or: [{target_id: d._id}, {action_id: d._id}]}, this);
                  }, cb
                );
              })(this.parallel());

              // Handle descendants.
              db.Hangtens.remove({parent_id: d._id}, this.parallel());
              db.Comments.remove({parent_id: d._id}, this.parallel());
              db.Subscriptions.remove({subscribee_id: d._id}, this.parallel());

              // Publish doc removed status.
              events.publish(type, type + '.removed', {data: {id: d._id.toString()}});
            }, this));
          },
          function (err) {
            if (err) return this(err);

            // Bulk remove all docs.
            db[_.capitalize(type) + 's'].remove({author_id: mid}, this);
          }, cb
        );
      });
    }

    Step(
      function () {
        var parallel = this.parallel;

        // Get events where member is actor.
        db.Events.list({actor_id: mid}, parallel());

        // Delete feed resources.
        _deleteResource('post', parallel());
        _deleteResource('session', parallel());
        _deleteResource('tick', parallel());
        // _deleteResource('ascent', parallel);
        // _deleteResource('crag', parallel);

        // Delete other resources.
        db.Actions.remove({author_id: mid}, parallel());
        db.Medias.remove({author_id: mid}, parallel());
        db.Hangtens.remove({author_id: mid}, parallel());
        db.Comments.remove({author_id: mid}, parallel());
        db.Subscriptions.remove({$or: [{subscriber_id: mid},
            {subscribee_id: mid}]}, parallel());
      },
      function (err, es) {
        if (err) return this(err);
        if (es.length === 0) {
          return this();
        }

        // Handle remaining notifications created by member.
        var _this = _.after(es.length, this);
        _.each(es, function (e) {
          db.Notifications.list({event_id: e._id}, function (err, notes) {
            if (err) return _this(err);

            // Publish removed statuses.
            _.each(notes, function (note) {
              events.publish('mem-' + note.subscriber_id.toString(),
                  'notification.removed', {data: {id: note._id.toString()}});
            });
            db.Notifications.remove({event_id: e._id}, _this);
          });
        });
      },
      function (err) {
        if (err) return this(err);

        // Handle remaining events created by member.
        db.Events.remove({actor_id: mid}, this.parallel());

        // Finally, remove the member.
        db.Members.remove({_id: mid}, this.parallel());
      },
      function (err) {
        if (errorHandler(err, req, res)) return;

        // Publish member removed status.
        events.publish('member', 'member.removed', {data: {id: mid.toString()}});

        // Logout.
        req.logout();
        delete req.session.referer;
        res.send({removed: true});
      }
    );
  });

  // Follow
  app.post('/api/members/:un/follow', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find doc.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (errorHandler(err, req, res, mem, 'member')) return;

      // Determine if a request is needed.
      var style = mem.config.privacy.mode.toString() === '1' ?
          'request': 'follow';

      // Create subscription.
      events.subscribe(req.user, mem, {style: style, type: 'member'},
          function (err, sub) {
        if (errorHandler(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({following: style === 'follow' || style});
      });

    });

  });

  // Unfollow
  app.post('/api/members/:un/unfollow', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find doc.
    db.Members.read({username: req.params.un}, function (err, mem) {
      if (errorHandler(err, req, res, mem, 'member')) return;

      // Remove subscription.
      events.unsubscribe(req.user, mem, function (err, sub) {
        if (errorHandler(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({unfollowed: true});
      });

    });

  });

  // Accept
  app.put('/api/members/:sid/accept', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find sub.
    db.Subscriptions.read({_id: db.oid(req.params.sid)}, function (err, sub) {
      if (errorHandler(err, req, res, sub, 'subscription')) return;

      // Update subscription.
      events.accept(sub, function (err, sub) {
        if (errorHandler(err, req, res, sub, 'subscription')) return;

        // Send status.
        res.send({followed: true});
      });

    });

  });

  // Auth
  app.post('/api/members/auth', function (req, res) {
    if (!req.body || !req.body.username || !req.body.password) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find member.
    db.Members.read({$or: [{username: req.body.username},
          {primaryEmail: req.body.username}]}, function (err, member) {
      if (errorHandler(err, req, res)) return;

      // Check password.
      if (!member || !member.password
          || iutil.encrypt(req.body.password, member.salt) !== member.password) {
        return res.send(401, {error: {message: 'Invalid credentials'}});
      }

      // Login.
      req.login(member, function (err) {
        if (errorHandler(err, req, res)) return;
        res.send({authenticated: true});
      });

    });
  });

  // Forgot
  app.post('/api/members/forgot', function (req, res) {
    if (!req.body || !req.body.email) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Find member.
    db.Members.read({primaryEmail: req.body.email}, function (err, member) {
      if (errorHandler(err, req, res, member, 'member')) return;

      if (!member.password) {
        return res.send(403, {error: {message: 'No password'},
            data: {provider: member.provider}});
      }

      // Send the email.
      emailer.reset(member, function (err) {
        if (errorHandler(err, req, res)) return;
        res.send({found: true});
      });
    });

  });

  // Reset
  app.post('/api/members/reset', function (req, res) {
    if (!req.body || !req.body.newpassword || !req.body.cnewpassword) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Check length
    if (req.body.newpassword.length < 7) {
      return res.send(403, {error: {message: 'Password too short'}});
    }

    // Compare new passwords.
    if (req.body.newpassword !== req.body.cnewpassword) {
      return res.send(403, {error: {message: 'Passwords do not match'}});
    }

    // Make new password.
    var props = {salt: iutil.salt()};
    props.password = iutil.encrypt(req.body.newpassword, props.salt);

    // Check for user.
    if (req.user) {

      // Get the member.
      db.Members.read({_id: req.user._id}, function (err, member) {
        if (errorHandler(err, req, res, member, 'member')) return;

        // Check old password.
        if (!member.password || !req.body.oldpassword
            || iutil.encrypt(req.body.oldpassword, member.salt) !== member.password) {
          return res.send(401, {error: {message: 'Invalid credentials'}});
        } else {
          update(member._id);
        }
      });
    
    // Check for session token.
    } else if (req.session.reset_token) {
      db.Keys.read({_id: db.oid(req.session.reset_token)}, function (err, key) {
        if (errorHandler(err, req, res, key, 'key')) return;
        delete req.session.reset_token;
        update(key.member_id);
      });
    } else {
      return res.send(403, {error: {message: 'Password reset session invalid'}});
    }

    // Do the update.
    function update(_id) {
      db.Members.update({_id: _id}, {$set: props},
          function (err, stat) {
        if (errorHandler(err, req, res, stat, 'member')) return;

        // All done.
        res.send({updated: true});
      });
    }
  });

  // Search
  app.post('/api/members/search/:s', function (req, res) {
    Step(
      function () {
        cache.search('members', req.params.s, 20, this, 'or');
      },
      function (err, ids) {
        if (err) return this(err);
        ids = _.map(ids, function(i) { return i.split('::')[1]; });

        // Check results.
        if (ids.length === 0) {
          return this();
        }

        // Map to actual object ids.
        var _ids = _.map(ids, function (id) {
          return db.oid(id);
        });

        // Get the matching posts.
        db.Members.list({_id: {$in: _ids}}, {sort: {created: -1}}, this);
      },
      function (err, mems) {
        if (errorHandler(err, req, res)) return;
        var filtered = [];
        _.each(mems, function (m) {
          filtered.push({
            username: m.username,
            displayName: m.displayName,
            gravatar: iutil.hash(m.primaryEmail || 'foo@bar.baz'),
          });
        });

        // Send profile.
        res.send(iutil.client({items: filtered}));
      }
    );
  });

  return exports;
}
