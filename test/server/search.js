var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');

var Search = require('island-search').Search;
var search;

var docId = '1234';

describe('Search', function() {
  it('Create redis connection', function(done) {
    search = new Search({
      redisHost: 'localhost'
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
});
