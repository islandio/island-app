// Run before all unit tests that require a database

var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');
var async = require('async');


var url = 'localhost:8080';
var cookies;

function createMember(name, cb) {
  var profile = {
    username: name,
    password: name,
    email: name + '@' + name + 'com'
  };

  request(url)
      .get('/api/members/' + name)
      .expect(200)
      .end(function(err, res) {
        if (!err && _.isEmpty(res.body)) {
          console.log('creating user ' + name);
          request(url)
              .post('/api/members')
              .send(profile)
              .end(function(err, res) {
                return cb(err);
              })
        } else {
          cb(err);
        }
      });
};

function login(name, cb) {
  var profile = {
    username: name,
    password: name,
    email: name + '@' + name + 'com'
  };
  request(url)
      .post('/api/members/auth')
      .send(profile)
      .expect(200)
      .end(function(err, res) {
        cookies = res.headers['set-cookie'].pop().split(';')[0];
        return cb(err);
      })
};

function logout(name, cb) {
  var req = request(url).get('/service/logout');
  req.cookies = cookies;
  req.expect(200, cb);
}

function deleteMember(name, cb) {
  var profile = {
    username: name,
    password: name
  }
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
}

function createCrag(name, cb) {
  var profile = {
    name: name,
    // SF
    location: {
      latitude: 37.7833,
      longitude: -122.4167
    }
  }
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

function createAscent(name, type, grade, cragid, cb) {
  var profile = {
    name: name,
    crag_id: cragid,
    type: type,
    grade: grade
  }
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


before('building a mini island database of users, ascents, crags', function(done) {
  this.timeout(30000);
  async.waterfall([
    function(cb) { createMember('islandTest', cb) },
    function(cb) { login('islandTest', cb) },
    function(cb) { createCrag('crag1', cb) },
    function(res, cb) { createAscent('ascent1', 'b', 3, res.body._id, cb) }
  ], done);
});

after('clearing database', function(done) {
  async.parallel([
    function(cb) { deleteMember('islandTest', cb) }
  ], done);
});

