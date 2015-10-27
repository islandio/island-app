// Run before all unit tests that require a database

var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');
var async = require('async');


var url = 'localhost:8080';
exports.url = url;

var cookies;

exports.createMember = function(name, cb) {
  var profile = {
    username: name,
    password: name,
    email: name + '@' + name + '.com'
  };
  request(url)
      .get('/api/members/' + name)
      .end(function(err, res) {
        if (res.statusCode === 404) {
          console.log('creating user ' + name);
          request(url)
              .post('/api/members')
              .send(profile)
              .end(function(err, res) {
                res.body.created.should.be.true();
                return cb(err);
              });
        } else {
          cb(err);
        }
      });
}

// Returns cookie
var login = exports.login = function(name, cb) {
  var profile = {
    username: name,
    password: name,
    email: name + '@' + name + '.com'
  };
  request(url)
      .post('/api/members/auth')
      .send(profile)
      .expect(200)
      .end(function(err, res) {
        cookies = res.headers['set-cookie'].pop().split(';')[0];
        return cb(err, cookies);
      });
}

exports.logout = function(name, cb) {
  var req = request(url).get('/service/logout');
  req.cookies = cookies;
  req.expect(200, cb);
}

exports.deleteMember = function(name, cb) {
  var profile = {
    username: name,
    password: name
  };
  login(name, function() { 
    request(url)
        .post('/api/members/auth')
        .send(profile)
        .expect(200)
        .end(function(err, res) {
          if (err) return cb(err);
          console.log('deleting user ' + name);
          var req = request(url).delete('/api/members/' + name);
          req.cookies = res.headers['set-cookie'].pop().split(';')[0];
          req.expect(200, cb);
        });
  });
}

exports.createCrag = function(name, cb) {
  var profile = {
    name: name,
    // SF
    location: {
      latitude: 37.7833,
      longitude: -122.4167
    }
  };
  console.log('creating crag ' + name);
  var req = request(url).post('/api/crags');
  req.cookies = cookies;
  req.send(profile)
      .expect(200)
      .end(function(err, res) {
        if (err) return cb(err);
        return cb(null, res);
      });
}

exports.createAscent = function(name, type, grade, cragid, cb) {
  var profile = {
    name: name,
    crag_id: cragid,
    type: type,
    grade: grade
  };
  console.log('creating ascent ' + name);
  var req = request(url).post('/api/ascents');
  req.cookies = cookies;
  req.send(profile)
    .expect(200)
    .end(function(err, res) {
        if (err) return cb(err);
        res.crag_id = cragid;
        return cb(null, res);
    });
}

// must be logged in
exports.createPost = function(body, cb) {
  var profile = {
    body: body
  }
  var req = request(url).post('/api/posts');
  req.cookies = cookies;
  req.send(profile)
      .expect(200)
      .end(function(err, res) {
        if (err) return cb(err);
        return cb(null, res);
      });
}

// must be logged in
exports.createComment = function(body, type, parent_id, cb) {
  var profile = {
    body: body,
    parent_id: parent_id
  }
  var req = request(url).post('/api/comments/' + type);
  req.cookies = cookies;
  req.send(profile)
      .expect(200)
      .end(function(err, res) {
        if (err) return cb(err);
        return cb(null, res);
      });
}

// must be logged in
exports.getNotifications = function(cb) {
  var req = request(url).get('/service/static');
  req.cookies = cookies;
  req.send()
      .expect(200)
      .end(function(err, res) {
        if (err) return cb(err);
        return cb(null, res.body.notes);
      });
}

