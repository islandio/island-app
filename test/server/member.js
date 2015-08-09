var should = require('should');
var assert = require('assert');
var request = require('supertest');

var url = 'localhost:8080';
var user = 'testdummy5'

var cookies;

describe('members resource', function() {
  it('check if service is up and user:' + user + ' doesn\'t exist', function(done) {
    request(url)
        .get('/api/members/' + user)
        .expect(200)
        .end(function(err, res) {
          res.body.should.be.empty();
          done(err);
        });
  });

  it('create user: POST to /api/members', function(done) {
    var profile = {
      username: user,
      password: user,
      email: user + '@wonderful.com',
    };
    request(url)
        .post('/api/members')
        .send(profile)
        .expect(200)
        .end(function(err, res) {
          res.body.created.should.be.true();
          // For logging in
          cookies = res.headers['set-cookie'].pop().split(';')[0];
          done(err);
        });
  });

  it('get user: GET to /api/members', function(done) {
    request(url)
        .get('/api/members/' + user)
        .expect(200)
        .end(function(err, res) {
          res.body.username.should.be.equal(user);
          done(err);
        });
  });

  it('delete user: DELETE to /api/members', function(done) {

    var req = request(url).delete('/api/members/' + user)
    req.cookies = cookies
    req.expect(200)
        .end(function(err, res) {
          done(err);
        });
  });

  it('verify delete: GET to /api/members', function(done) {
    request(url)
        .get('/api/members/' + user)
        .expect(200)
        .end(function(err, res) {
          res.body.should.be.empty();
          done(err);
        });
  });

});
