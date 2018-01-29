var should = require('should');
var assert = require('assert');
var request = require('@islandio/supertest');
var _ = require('underscore');

var iutil = require('@islandio/util');

describe('Island Utils', function() {
  it('atmentions function', function() {
    var teststr = 'Test of @mentions for @users of different @names'
    var res = iutil.atmentions(teststr);
    res[0].should.equal('mentions');
    res[1].should.equal('users');
    res[2].should.equal('names');
  })
});
