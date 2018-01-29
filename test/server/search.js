var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');

var Search = require('@islandio/search').Search;
var search;

var docId = '1234';

describe('Search', function() {
  after('teardown redis', function (done) {
    search.client.quit()
    done()
  });
  it('Create redis connection', function(done) {
    search = new Search({
      redisHost: process.env.REDIS_HOST_CACHE || 'localhost',
      redisPort: process.env.REDIS_PORT || 6379
    }, done);
  });
  it('Index a document', function(done) {
    var ascentDoc = {
      _id: docId,
      name: 'Eyals Killer Climb',
      type: 'deadlyice'
    };
    search.index('tests', ascentDoc, ['name', 'type'], done);
  });
  it('Search for positive document matches', function(done) {

    var positiveTests = [
      'Eyal',
      'Eyals',
      'Killer',
      'Climb',
      'climb',
      'eyals killer',
      'eyals killer climb',
      'deadlyice'
    ];
    var cb = _.after(positiveTests.length, done);
    function check(err, res) {
      res.should.be.Array();
      res[0].split('::')[1].should.eql(docId);
      cb(err);
    }
    _.each(positiveTests, function(t) {
      search.search('tests', t, 10, check);
    });
  });
  it('Search for negative document matches', function(done) {

    var negativeTests = [
      'Foo',
      'Bar',
    ];
    var cb = _.after(negativeTests.length, done);
    function check(err, res) {
      res.should.be.Array();
      res.length.should.equal(0);
      cb(err);
    }
    _.each(negativeTests, function(t) {
      search.search('tests', t, 10, check);
    });
  });
  it('Index then search 10,000 documents', function(done) {
    this.timeout(20000);
    var toIndex = 10000;
    // will contain last added values
    var name, id;
    var cb = _.after(toIndex, function() {
      search.search('tests', name, 10, function(err, res) {
        res[0].split('::')[1].should.equal(id);
        done(err);
      });
    });
    function addRandomDoc() {
      name = Math.random().toString().substr(2, 10);
      id = Math.random().toString().substr(2, 10);
      var doc = {
        _id: id,
        name: name
      };
      search.index('tests', doc, ['name'], cb);
    }
    for (var i = 0; i < toIndex; i++) {
      addRandomDoc();
    }
  });
});
