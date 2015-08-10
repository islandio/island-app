var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');

var lib8a = require('island-lib8a');
var lib27 = require('island-lib27crags');

var lib8aUserId, lib27UserId;

describe('Import8a', function() {
  it('8a search for daniel woods', function(done) {
    this.timeout(30000);
    lib8a.searchUser('Daniel Woods', function(err, res) {
      res.should.be.Array();
      res[0].userId.should.equal('4102');
      res[0].name.should.equal('Daniel Woods');
      res[0].city.should.equal('Longmont');
      res[0].country.should.equal('United States');

      lib8aUserId = res[0].userId;

      done(err);
    });
  });
  it('8a get ticks for Daniel Woods', function(done) {
    this.timeout(30000);
    lib8a.getTicks(lib8aUserId, function(err, res) {
      res.should.be.Array();
      var tick = _.find(res, function(r) {
        return r.ascent === 'Apu';
      });
      tick.sent.should.equal(true);
      tick.ascent.should.equal('Apu');
      tick.recommended.should.equal(false);
      tick.crag.should.equal('Hatun Machay');
      tick.ascentSector.should.equal('');
      tick.first.should.equal(true);
      tick.feel.should.equal('Soft');
      tick.secondGo.should.equal(false);
      tick.note.should.be.String();
      tick.rating.should.equal(3);
      tick.type.should.equal('b');
      tick.grade.should.equal('8b');
      done(err);
    });
  });
});

describe('Import27crags', function() {
  it('27crags search for daniel woods', function(done) {
    this.timeout(30000);
    lib27.searchUser('Daniel Woods', function(err, res) {
      res.should.be.Array();
      res[0].userId.should.equal('dawoods89');
      res[0].name.should.equal('Daniel Woods');

      lib27UserId = res[0].userId;

      done(err);
    });
  });
  it('27crags get ticks for Daniel Woods', function(done) {
    this.timeout(30000);
    lib27.getTicks(lib27UserId, function(err, res) {
      res.should.be.Array();
      var tick = _.find(res, function(r) {
        return r.ascent === 'Warpath';
      });
      tick.sent.should.equal(true);
      tick.ascent.should.equal('Warpath');
      tick.recommended.should.equal(false);
      tick.crag.should.equal('Castle Rock, Idaho');
      tick.first.should.equal(false);
      tick.note.should.be.String();
      tick.rating.should.equal(3);
      tick.type.should.equal('b');
      tick.grade.should.equal('8b+');
      done(err);
    });
  });
});

