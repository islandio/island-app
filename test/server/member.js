var should = require('should');
var assert = require('assert');
var request = require('supertest');
var common = require('../../test/common');

var user = 'testdummy7';
var cookies;

describe('Members', function() {

  it('create user: POST to /api/members', function(done) {
    common.createMember(user, function(err) {
      done();
    });
  });

  it('login to user: POST to /api/members/auth', function(done) {
    common.login(user, function(err, _cookies) {
      cookies = _cookies;
      done(err);
    });
  });

  it('get user: GET to /api/members', function(done) {
    request(common.url)
        .get('/api/members/' + user)
        .expect(200)
        .end(function(err, res) {
          res.body.username.should.be.equal(user);
          done(err);
        });
  });

  it('delete user: DELETE to /api/members', function(done) {
    var req = request(common.url).delete('/api/members/' + user);
    req.cookies = cookies;
    req.expect(200)
        .end(function(err, res) {
          done(err);
        });
  });

  it('verify delete: GET to /api/members', function(done) {
    request(common.url)
        .get('/api/members/' + user)
        .expect(404)
        .end(function(err, res) {
          res.body.error.message.should.be.exactly('member not found');
          done(err);
        });
  });

});
