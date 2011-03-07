var express = require('express')
  , connect = require('connect')
  , jade = require('jade')
  , app = module.exports = express.createServer()
  //, io = require('socket.io')
  //, nodestream = require('nodestream')
  , formidable = require('formidable')
  , mongoose = require('mongoose')
  , mongoStore = require('connect-mongodb')
  , s3client = require('knox').createClient({
      key: 'AKIAJE7B76FRJNGSKWCA',
      secret: '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',
      bucket: 'islandio'
    })
  , im = require('imagemagick')
  , stylus = require('stylus')
  , markdown = require('markdown').markdown
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
  , Settings = { development: {}, test: {}, production: {} };

app.helpers(require('./helpers.js').helpers);
app.dynamicHelpers(require('./helpers.js').dynamicHelpers);

app.configure('development', function() {
  app.set('db-uri', 'mongodb://localhost/islandio-development');
  app.use(express.errorHandler({ dumpExceptions: true }));  
});

app.configure('test', function() {
  app.set('db-uri', 'mongodb://localhost/islandio-test');
});

app.configure('production', function() {
  app.set('db-uri', 'mongodb://localhost/islandio-production');
});

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
  app.use(express.session({ store: mongoStore(app.set('db-uri')), secret: 'topsecret' }));
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
  app.use(express.methodOverride());
  app.use(stylus.middleware({ src: __dirname + '/public' }));
  app.use(express.staticProvider(__dirname + '/public'));
});

models.defineModels(mongoose, function() {
  app.Member = Member = mongoose.model('Member');
  app.Comment = Comment = mongoose.model('Comment');
  app.Media = Media = mongoose.model('Media');
  app.LoginToken = LoginToken = mongoose.model('LoginToken');
  db = mongoose.connect(app.set('db-uri'));
});

function authenticateFromLoginToken(req, res, next) {
  var cookie = JSON.parse(req.cookies.logintoken);

  LoginToken.findOne({ email: cookie.email,
                       series: cookie.series,
                       token: cookie.token }, (function(err, token) {
    if (!token) {
      res.redirect('/sessions/new');
      return;
    }

    Member.findOne({ email: token.email }, function(err, member) {
      if (member) {
        req.session.member_id = member.id;
        req.currentMember = member;

        token.token = token.randomToken();
        token.save(function () {
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          next();
        });
      } else {
        res.redirect('/sessions/new');
      }
    });
  }));
}

function loadMember(req, res, next) {
  if (req.session.member_id) {
    Member.findById(req.session.member_id, function (err, member) {
      if (member) {
        req.currentMember = member;
        next();
      } else {
        res.redirect('/sessions/new');
      }
    });
  } else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, next);
  } else {
    res.redirect('/sessions/new');
  }
}

app.get('/', loadMember, function (req, res) {
  res.redirect('/media')
});








// Error handling
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
    res.render('404.jade', { status: 404 });
  } else {
    next(err);
  }
});

/*
app.error(function(err, req, res) {
  res.render('500.jade', {
    status: 500,
    locals: {
      error: err
    } 
  });
});
*/


// Media list
app.get('/media', loadMember, function (req, res) {
  Media.find({}, function (err, media) {
    var num = media.length
      , cnt = 0
    ;
    media.forEach(function (med) {
      Member.findById(med.member_id, function (err, member) {
        med.member = member;
        cnt++;
        if (cnt == num) {
          switch (req.params.format) {
            case 'json':
              res.send(media.map(function (d) {
                return d.toObject();
              }));
            break;
            default:
              res.render('index.jade', {
                locals: { p: 'media', d: media, cm: req.currentMember }
              });
          }
        }
      });
    });
  });
});

app.get('/media/:id.:format?/edit', loadMember, function (req, res, next) {
  Media.findById(req.params.id, function (err, d) {
    if (!d) return next(new NotFound('Media not found'));
    res.render('media/edit.jade', {
      locals: { d: d, currentMember: req.currentMember }
    });
  });
});

app.get('/media/new', loadMember, function (req, res) {
  res.render('media/new.jade', {
    locals: { d: new Media(), currentMember: req.currentMember }
  });
});

// Create media 
app.post('/media.:format?', function (req, res) {
  // create a new form
  var form = new formidable.IncomingForm();
  // form.keepExtensions = true;
  // handle parts
  form.onPart = function (part) {
    if (!part.filename) {
      form.handlePart(part);
    } else {
      (function () {
        var file = {
          filename: part.filename, 
          mime: part.mime, 
          length: 0, 
          hash: require('crypto').createHash('md5'), 
          buffers: []
        };
        part.on('data', function (buf) {
          file.buffers.push(buf);
          file.length += buf.length;
          file.hash.update(buf);
        });
        part.on('end', function () {
          form.emit('file', part.name, file);
        });
      }());
    }
  };
  
  form.parse(req, function (err, fields, files) {
    if (err) return mediaAddFailed();
    // ensure member is valid -- need fix, breaks onion ring
    loadMember(req, res, function () {
      if (utils.isEmpty(files))
        capture();
      // begin stream to s3
      else {
        for (f in files) {
          var buffer = new Buffer(files[f].length)
            , file_name = files[f].hash.digest('hex')// + path.extname(files[f].filename)
            , length = 0;
          files[f].buffers.forEach(function (buf) {
            buf.copy(buffer, length, 0);
            length += buf.length;
          });
          s3client.put(file_name, {
            'Content-Length': buffer.length,
            'Content-Type': 'text/plain'
          }).on('response', function (res) {
            if (200 == res.statusCode) {
              //fields.location = res.headers.etag.substr(1).substr(0, res.headers.etag.length - 2);
              fields.location = this.url;
              console.log('object saved to %s', this.url);
              capture();
            }
          }).end(buffer);
        }
        // capture();
        req.flash('info', 'Media added to queue');
        res.redirect('/media');
      }
      // save to db
      function capture() {
        //req.currentMember.media.push(fields);
        //req.currentMember.save(function(err) {
        fields.member_id = req.currentMember.id;
        var d = new Media(fields);
        d.save(function(err) {
          // switch (req.params.format) {
          //   case 'json':
          //     res.send(req.currentMember.toObject());
          //     break;
          //   default:
          //     req.flash('info', 'Media created');
          //     res.redirect('/media');
          // }
        });
      }
    });
  });
  
  function mediaAddFailed() {
    req.flash('error', 'Media creation failed');
    res.render('media/new.jade', {
      locals: { }
    });
    return false;
  }
    
});

// Read media
app.get('/media/:id.:format?', loadMember, function(req, res, next) {
  Media.findById(req.params.id, function(err, d) {
    if (!d) return next(new NotFound('Media not found'));

    switch (req.params.format) {
      case 'json':
        res.send(d.toObject());
      break;

      case 'html':
        res.send(markdown.toHTML(d.data));
      break;

      default:
        res.render('media/show.jade', {
          locals: { d: d, currentMember: req.currentMember }
        });
    }
  });
});

// Update media
app.put('/media/:id.:format?', loadMember, function(req, res, next) {
  Media.findById(req.body.d.id, function(err, d) {
    if (!d) return next(new NotFound('Media not found'));

    d.title = req.body.d.title;
    d.data = req.body.d.data;

    d.save(function(err) {
      switch (req.params.format) {
        case 'json':
          res.send(d.toObject());
        break;

        default:
          req.flash('info', 'Media updated');
          res.redirect('/media');
      }
    });
  });
});

// Delete media
app.del('/media/:id.:format?', loadMember, function (req, res, next) {
  Media.findById(req.params.id, function (err, d) {
    if (!d) return next(new NotFound('Media not found'));

    d.remove(function () {
      switch (req.params.format) {
        case 'json':
          res.send('true');
        break;

        default:
          req.flash('info', 'Media deleted');
          res.redirect('/media');
      } 
    });
  });
});


app.get('/i/:id.:format?', function (req, res) {
  // 
  // // get image id
  // var id
  //   , width
  //   , height
  // ;
  // try {
  //   var items = req.params.id.split('-');
  //   id = items[0];
  //   var dims = items[items.length - 1];
  //   if (dims.indexOf('w') === 0)
  //     width = dims.substr(1);
  // } catch (exception) {
  //   id = null;
  // }
  // 
  // var path = __dirname + '/public/' + req.url;
  // var tmp = __dirname + '/public/' + req.url + '.tmp';
  // 
  // s3client.get(id + '.jpg').on('response', function (s3res) {
  //   var outstream = fs.createWriteStream(tmp);
  //   s3res.on('data', function (chunk) {
  //     outstream.write(chunk);
  //   }).on('end', function () {
  //     outstream.emit('close');
  //     
  //     im.resize({
  //       srcPath: tmp,
  //       dstPath: path,
  //       width: width
  //     }, function(err, stdout, stderr){
  //       if (err) throw err
  //       console.log('resized kittens.jpg to fit within 256x256px')
  //     });
  //     
  //     
  //     res.redirect(req.url);
  //   });
  //   
  // }).end();
  
});


app.get('/:obj?', loadMember, function (req, res) {
  Media.findById(req.url.substring(1), function (err, media) {
    Member.findById(media.member_id, function (err, member) {
      var num = media.comments.length
        , cnt = 0
      ;
      if (num == 0) {
        res.render('index.jade', {
          locals: { p: 'single', d: media, m: member, cm: req.currentMember }
        });
      } else {
        media.comments.reverse();
        media.comments.forEach(function (com) {
          Member.findById(com.member_id, function (err, commentor) {
            com.member = commentor;
            cnt++;
            if (cnt == num) {
              res.render('index.jade', {
                locals: { p: 'single', d: media, m: member, cm: req.currentMember }
              });
            }
          });
        });
      }
    });
  });
});


// Add comment
app.put('/comment/:id.:format?', loadMember, function (req, res, next) {
  Media.findById(req.body.d.id, function (err, d) {
    if (!d) return next(new NotFound('Can\'t comment...media not found. Crap.'));
    d.comments.push({ 
        body: req.body.d.data
      , member_id: req.currentMember.id 
    });
    d.save(function (err) {
      var comment = d.comments.pop().toObject();
      comment.member = req.currentMember;
      res.send({ comment: res.partial('comment.jade', [comment]) });
    });
  });
});





// Members
app.get('/members/new', function(req, res) {
  res.render('members/new.jade', {
    locals: { member: new Member() }
  });
});

app.post('/members.:format?', function(req, res) {
  var member = new Member(req.body.member);

  function memberSaveFailed() {
    req.flash('error', 'Account creation failed');
    res.render('members/new.jade', {
      locals: { member: member }
    });
  }

  member.save(function(err) {
    if (err) return memberSaveFailed();

    req.flash('info', 'Your account has been created');
    switch (req.params.format) {
      case 'json':
        res.send(member.toObject());
      break;

      default:
        req.session.member_id = member.id;
        res.redirect('/media');
    }
  });
});

// Sessions
app.get('/sessions/new', function(req, res) {
  res.render('sessions/new.jade', {
    locals: { member: new Member() }
  });
});

app.post('/sessions', function (req, res) {
  Member.findOne({ email: req.body.member.email }, function (err, member) {
    if (member && member.authenticate(req.body.member.password)) {
      req.session.member_id = member.id;
      // Remember me
      if (req.body.remember_me) {
        var loginToken = new LoginToken({ email: member.email });
        loginToken.save(function () {
          res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
        });
      }
      res.redirect('/media');
    } else {
      req.flash('error', 'Incorrect credentials');
      res.redirect('/sessions/new');
    }
  }); 
});

app.del('/sessions', loadMember, function (req, res) {
  if (req.session) {
    LoginToken.remove({ email: req.currentMember.email }, function () {});
    res.clearCookie('logintoken');
    req.session.destroy(function () {});
  }
  res.redirect('/sessions/new');
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express server listening on port %d, environment: %s', app.address().port, app.settings.env)
  console.log('Using connect %s, Express %s, Jade %s', connect.version, express.version, jade.version);
}
