// Run before all unit tests that require a database

var should = require('should');
var assert = require('assert');
var request = require('@islandio/supertest');
var _ = require('underscore');
var async = require('async');
var common = require('../../test/common');

/*
before('building a mini island database of users, ascents, crags',
    function(done) {
  this.timeout(30000);
  async.waterfall([
    function(cb) { common.createMember('islandTest', cb); },
    function(cb) { common.login('islandTest', cb); },
    function(cookie, cb) { common.createCrag('crag1', cb); },
    function(res, cb) { common.createAscent('ascent1', 'b', 3, res.body._id, cb); }
  ], done);
});

after('clearing database', function(done) {
  async.parallel([
    function(cb) { common.deleteMember('islandTest', cb); }
  ], done);
});
*/
