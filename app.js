var express = require('express')
  , jade = require('jade')
  , stylus = require('stylus')
  , markdown = require('markdown').markdown
  , app = module.exports = express.createServer()
  , mongoose = require('mongoose')
  , MongoStore = require('connect-mongodb')
  , fs = require('fs')
  , sys = require('sys')
  , path = require('path')
  , models = require('./models')
  , utils = require('./utils.js')
  , db
  , Media
  , Comment
  , Member
  , LoginToken
  , Notify = require('./notify')
  , Settings = { development: {}, test: {}, production: {} }
  , transloadit = {
        "auth": {
            "key": "8a36aa56062f49c79976fa24a74db6cc"
          }
      , "template_id": "dd77fc95cfff48e8bf4af6159fd6b2e7"
    }
;

app.helpers(require('./helpers.js').helpers);
app.dynamicHelpers(require('./helpers.js').dynamicHelpers);

app.configure('development', function () {
  app.set('db-uri', 'mongodb://localhost:27020/islandio-development,mongodb://localhost:27021,mongodb://localhost:27022');
  app.set('sessions-host', 'localhost');
  app.set('sessions-port', [27017, 27018, 27019]);
  app.use(express.errorHandler({ dumpExceptions: true }));
});

app.configure('test', function () {
  app.set('db-uri', 'mongodb://localhost:27020/islandio-test,mongodb://localhost:27021,mongodb://localhost:27022');
  app.set('sessions-host', 'localhost');
  app.set('sessions-port', [27017, 27018, 27019]);
});

app.configure('production', function () {
  app.set('db-uri', 'mongodb://10.242.63.18:27017/islandio-production,mongodb://10.117.95.200:27017,mongodb://10.196.190.94:27017');
  app.set('sessions-host', ['10.242.63.18','10.117.95.200','10.196.190.94']);
  app.set('sessions-port', 27017);
  app.use(express.errorHandler({ dumpExceptions: true }));
});

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    cookie: { maxAge: 86400 * 1000 }, // one day 86400
    secret: 'topsecretislandshit',
    store: new MongoStore({
      host: app.set('sessions-host'),
      port: app.set('sessions-port'),
      dbname: 'islandio-sessions'
    })
  }));
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
  app.use(express.methodOverride());
  app.use(stylus.middleware({ src: __dirname + '/public' }));
  app.use(express.static(__dirname + '/public'));
});

models.defineModels(mongoose, function () {
  app.Member = Member = mongoose.model('Member');
  app.Comment = Comment = mongoose.model('Comment');
  app.Rating = Rating = mongoose.model('Rating');
  app.Media = Media = mongoose.model('Media');
  app.LoginToken = LoginToken = mongoose.model('LoginToken');
  db = mongoose.connectSet(app.set('db-uri'));
});


/**
 * 
 * @param
 */
 
function authenticateFromLoginToken(req, res, next) {
  var cookie = JSON.parse(req.cookies.logintoken);
  LoginToken.findOne({ 
      email: cookie.email
    , series: cookie.series
    , token: cookie.token }, (function (err, token) {
    if (!token) {
      res.redirect('/login');
      return;
    }
    Member.findOne({ email: token.email }, function (err, member) {
      if (member) {
        req.session.member_id = member.id;
        req.currentMember = member;
        token.token = token.randomToken();
        token.save(function () {
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          next();
        });
      } else {
        res.redirect('/login');
      }
    });
  }));
}


/**
 * 
 * @param
 */
 
function loadMember(req, res, next) {
  if (req.session.member_id) {
    Member.findById(req.session.member_id, function (err, mem) {
      if (mem) {
        req.currentMember = mem;
        if (mem.meta.logins == 0) {
          req.flash('thanks', 'Thanks for confirming your email address. Welcome to Island.');
          mem.meta.logins++
          mem.save(function (err) {
            if (err)
              Notify.problem(err);
          });
        }
        next();
      } else {
        res.redirect('/login');
      }
    });
  } else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, next);
  } else {
    res.redirect('/login');
  }
}


/**
 * 
 * @param
 */
 
function findMedia(next, filter) {
  Media.find(filter, function (err, media) {
    if (!err) {
      var num = media.length
        , cnt = 0
      ;
      if (num > 0)
        media.forEach(function (med) {
          Member.findById(med.member_id, function (err, member) {
            med.member = member;
            cnt++;
            if (cnt == num)
              next(media);
          });
        });
      else 
        next([]);
    } else 
      next([]);
  });
}


/**
 * 
 * @param
 */
 
function getTrending(limit, next) {
  Media.find({}, [], { limit: limit }).sort('meta.hearts', -1).run(function (err, media) {
    if (!err) {
      var num = media.length
        , cnt = 0
      ;
      if (num > 0)
        media.forEach(function (med) {
          Member.findById(med.member_id, function (err, member) {
            med.member = member;
            cnt++;
            if (cnt == num)
              next(media);
          });
        });
      else
        next([]);
    } else
      next([]);
  });
}


/**
 * 
 * @param
 */
 
function getRecentComments(limit, next) {
  Comment.find({}, [], { limit: limit }).sort('added', -1).run(function (err, coms) {
    var num = coms.length
      , cnt = 0
    ;
    if (err || num == 0)
      next([]);
    else
      coms.forEach(function (com) {
        Member.findById(com.member_id, function (err, mem) {
          if (!err) {
            com.member = mem;
            Media.findById(com.parent_id, function (err, med) {
              if (!err) {
                com.parent = med;
                cnt++;
                if (cnt == num)
                  next(coms);
              } else {
                next([]);
                return;
              }
            });
          } else {
            next([]);
            return;
          }
        });
      });
  });
}


/**
 * Transform text array of searchable terms
 * @param string text
 */

function makeTerms(text) {
  text = text.replace(/[~|!|@|#|$|%|^|&|*|(|)|_|+|`|-|=|[|{|;|'|:|"|\/|\\|?|>|.|<|,|}|]|]+/gi, '');
  text = text.replace(/\s{2,}/g, ' ');
  return text.toLowerCase().trim().split(' ');
}


/**
 * 
 * @param
 */
 
function renderObject(obj, next) {
  Member.findById(obj.member_id, function (err, mem) {
    if (!err) {
      obj.member = mem;
      jade.renderFile(path.join(__dirname, 'views', 'object.jade'), { locals: { object: obj } }, function (err, html) {
        if (!err)
          next(html);
        else
          next(err);
      });
    } else
      next(err);
  });
}


/**
 * 
 * @param
 */
 
function renderComment(com, next) {
  Member.findById(com.member_id, function (err, mem) {
    if (!err) {
      com.member = mem;
      Media.findById(com.parent_id, function (err, med) {
        if (!err) {
          jade.renderFile(path.join(__dirname, 'views', 'comment.jade'), { locals: { comment: com } }, function (err, chtml) {
            if (!err) {
              com.parent = med;
              jade.renderFile(path.join(__dirname, 'views', 'comment.jade'), { locals: { comment: com } }, function (err, rhtml) {
                if (!err)
                  next(chtml, rhtml);
                else
                  next(err);
              });
            } else
              next(err);
          });
        } else
          next([]);
      });
    } else
      next(err);
  });
}


/**
 * 
 * @param
 */
 
function getTwitterNames(next) {
  Member.find({}, function (err, data) {
    if (!err) {
      var twitters = []
        , num = data.length
        , cnt = 0
      ;
      if (num > 0)
        data.forEach(function (mem) {
          twitters.push(mem.twitter);
          cnt++;
          if (cnt == num)
            next(twitters);
        });
      else 
        next([]);
    } else 
      next([]);
  });
}


/**
 * 
 * @param
 */
 
function NotFound(msg) {
  this.name = 'NotFound';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
}

sys.inherits(NotFound, Error);

app.get('/404', function (req, res) {
  throw new NotFound;
});

app.get('/500', function (req, res) {
  throw new Error('An expected error');
});

app.get('/bad', function (req, res) {
  unknownMethod();
});

app.error(function (err, req, res, next) {
  if (err instanceof NotFound) {
    res.render('404', { status: 404 });
  } else {
    next(err);
  }
});


// Home page
app.get('/', loadMember, function (req, res) {
  findMedia(function (media) {
    getTrending(5, function (trends) {
      getRecentComments(6, function (coms) {
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


// Confirm page
app.get('/confirm/:id', function (req, res) {
  Member.findById(req.params.id, function (err, mem) {
    if (!err) {
      mem.confirmed = true;
      mem.save(function (err) {
        if (!err) {
          req.currentMember = mem;
          req.session.member_id = mem.id;
          res.redirect('/');
        } else {
          res.redirect('/login');
          Notify.problem(err);
        }
      });
    } else {
      res.redirect('/login');
      Notify.problem(err);
    }
  });
});


// Add media form
app.get('/add', loadMember, function (req, res) {
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
app.get('/:id', loadMember, function (req, res) {
  Media.findById(req.params.id, function (err, med) {
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


// Login - add member to session
app.post('/sessions', function (req, res) {
  // check fields
  var missing = [];
  if (!req.body.member.email)
    missing.push('email');
  if (!req.body.member.password)
    missing.push('password');
  if (missing.length != 0) {
    res.send({ status: 'fail', data: { code: 'MISSING_FIELD', message: 'Hey, we need both those fields to get you in here ;)', missing: missing } });
    return;
  }
  Member.findOne({ email: req.body.member.email }, function (err, mem) {
    if (mem && mem.authenticate(req.body.member.password)) {
      if (!mem.confirmed) {
        res.send({
            status: 'fail'
          , data: { 
                code: 'NOT_CONFIRMED'
              , message: 'Hey there, ' + mem.name.first + '. You must confirm your account before we can let you in here. I can <a href="javascript:;" id="noconf-' + mem.id + '" class="resend-conf">re-send the confirmation email</a> if you\'d like.'
            }
        });
        return;
      }
      mem.meta.logins++
      mem.save(function (err) {
        if (!err) {
          req.session.member_id = mem.id;
          if (req.body.remember_me) {
            var loginToken = new LoginToken({ email: mem.email });
            loginToken.save(function () {
              res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
              res.send({ status: 'success' });
            });
          } else
            res.send({ status: 'success' });
        } else {
          res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try registering again later.' });
          Notify.problem(err);
        }
      });
    } else {
      res.send({
          status: 'fail'
        , data: { 
              code: 'BAD_AUTH'
            , message: 'Hey, sorry. That didn\'t work. Your email or password is incorrect.'
          }
      });
    }
  });
});


// Resend Confirmation Email
app.post('/resendconf/:id?', function (req, res) {
  if (!req.params.id) {
    res.send({ status: 'error', message: 'Invalid request.' });
    return;
  } else {
    Member.findById(req.body.id, function (err, mem) {
      if (mem) {
        var confirm = 'http://' + path.join(req.headers.host, 'confirm', mem.id);
        Notify.welcome(mem, confirm, function (err, message) {
          if (!err)
            res.send({ status: 'success', data: { message: 'Excellent, ' + mem.name.first + '. Please check your inbox for the next step. There\'s only one more... I promise.', member: mem } });
          else {
            res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try registering again later.' });
            Notify.problem(err);
          }
        });
      } else
        res.send({ status: 'error', message: 'Oops, we lost your account info. Please register again.' });
    });
  }
});


// Add Member
app.put('/members', function (req, res) {
  // check fields
  var missing = [];
  if (!req.body.newmember['name.first'])
    missing.push('name.first');
  if (!req.body.newmember['name.last'])
    missing.push('name.last');
  if (!req.body.newmember.email)
    missing.push('email');
  if (!req.body.newmember.email2)
    missing.push('email2');
  if (!req.body.newmember.password)
    missing.push('password');
  if (missing.length != 0) {
    res.send({ status: 'fail', data: { code: 'MISSING_FIELD', message: 'Hey, we need all those fields for this to work.', missing: missing } });
    return;
  }
  // compare emails
  if (req.body.newmember.email2 != req.body.newmember.email) {
    res.send({ status: 'fail', data: { code: 'INVALID_EMAIL', message: 'Oops. You didn\'t re-enter your email address correctly. Please do it right and try registering again.' } });
    return;
  } else
    delete req.body.newmember.email2;
  // create new member
  var member = new Member(req.body.newmember);
  member.save(function (err) {
    if (!err) {
      var confirm = 'http://' + path.join(req.headers.host, 'confirm', member.id);
      Notify.welcome(member, confirm, function (err, message) {
        if (!err)
          res.send({ status: 'success', data: { message: 'Excellent. Please check your inbox for the next step. There\'s only one more, I promise.', member: member } });
        else {
          res.send({ status: 'error', message: '#FML. We\'re experiencing an unknown problem but are looking into it now. Please try registering again later.' });
          Notify.problem(err);
        }
      });
    } else
      res.send({ status: 'fail', data: { code: 'DUPLICATE_EMAIL', message: 'Your email address is already being used on our system. Please try registering with a different address.' } });
  });
});


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


// Delete a session on logout
app.del('/sessions', loadMember, function (req, res) {
  if (req.session) {
    LoginToken.remove({ email: req.currentMember.email }, function () {});
    res.clearCookie('logintoken');
    req.session.destroy(function () {});
  }
  res.redirect('/login');
});


// Go live
if (!module.parent) {
  
  // listening...
  app.listen(8080);
  
  // init now.js
  var everyone = require('now').initialize(app);
  
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
        everyone.now.receiveComment({ status: 'success', data: { pid: data.pid, com: cren, rec: rren } });
      else
        everyone.now.receiveComment({ status: 'error', message: cren.message || rren.message });
    });
  };
  
  // update everyone with new trends
  var distributeTrends = function () {
    getTrending(5, function (trends) {
      var rendered = []
        , num = trends.length
        , cnt = 0
      ;
      if (num == 0)
        return;
      else
        trends.forEach(function (med) {
          jade.renderFile(path.join(__dirname, 'views', 'trend.jade'), { locals: { trend: med } }, function (err, html) {
            if (!err) {
              rendered.push(html);
              cnt++;
              if (cnt == num)
                everyone.now.receiveTrends({ status: 'success', data: { trends: rendered } });
            } else
              return;
          });
        });
    });
  };
  setInterval(distributeTrends, 5000);
  
  // Server info
  console.log('Express server listening on port %d, environment: %s', app.address().port, app.settings.env)
  console.log('Express %s, Jade %s', express.version, jade.version);
}
