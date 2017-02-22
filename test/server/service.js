var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');
var async = require('async');

var url = 'localhost:8080';

function route(r, q) {
  var base = '/service/' + r;
  if (!q) return base;
  var first = true;
  _.each(q, function(v, k) {
    base += first ? '?' : '&';
    first = false;
    base += (k + '=' + v);
  });
  return base;
}

var cookies;

describe('Service (not logged in)', function() {

  it('static profiles', function(done) {
    request(url)
        .get(route('static'))
        .expect(200)
        .end(function(err, res) {
          res.body.should.not.be.empty();
          done(err);
        });
  });

  it('activity profile', function(done) {
    request(url)
        .get(route('activity', {actions: 'all'}))
        .expect(200, done);
  });

  it('media profile', function(done) {
    request(url)
        .get(route('media'))
        .expect(200, function(err, res) {
          res.body.content.events.should.not.be.empty();
          res.body.content.events.items.should.be.Array();
          done(err);
        });
  });

/*
  it('ticks', function(done) {
    request(url)
        .get(route('ticks') + '/islandTest')
        .expect(200, function(err, res) {
          res.body.content.page.ticks.should.be.empty();
          done(err);
        });
  });
*/

});
