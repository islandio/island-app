var should = require('should');
var assert = require('assert');
var request = require('supertest');
var store = require('../../lib/resources/store');
var skus = Object.keys(require('../../store.json'));

var url = 'localhost:8080';

var invalidAddress = {foo: 'bar'};

var nonExistingAddress = {
  name: 'Whereis Waldo',
  address: '123 Nowhere Rd',
  city: 'Notarealcity',
  state: 'ZZ',
  zip: '99999',
  country: 'Fakelandia'
};

var goodAddress = {
  name: 'Karl Johnson',
  address: '530 N Montana Ave',
  city: 'Bozeman',
  state: 'MT',
  zip: '59715',
  country: 'United States'
};

var emptyCart = {};

var invalidCart = {'Not-A-Real-SKU': 3};

var overMaxCart = {'M3-Island-Brush': store.MAX_PRODUCT_QUANTITY_PER_ORDER + 1};

var goodCart = {'M1-Island-Brush': 1};

describe('Store API', function() {
  it('request shipping rate with no address', function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          cart: goodCart
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly('Address invalid');
          done(err);
        });
  });

  it('request shipping rate with invalid address', function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          address: invalidAddress,
          cart: goodCart
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly('Address invalid');
          done(err);
        });
  });

  it('request shipping rate with non-existing address', function(done) {
    this.timeout(5000);
    request(url)
        .post('/api/store/shipping')
        .send({
          address: nonExistingAddress,
          cart: goodCart
        })
        .expect(400)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly(
              'No shipping options found for the specified address');
          done(err);
        });
  });

  it('request shipping rate with good address', function(done) {
    this.timeout(5000);
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress,
          cart: goodCart
        })
        .expect(200)
        .end(function(err, res) {
          res.body.should.have.property('shipTo');
          res.body.should.have.property('options');
          done(err);
        });
  });

  it('request shipping rate with no cart', function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly('Cart invalid');
          done(err);
        });
  });

  it('request shipping rate with empty cart', function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress,
          cart: emptyCart
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly('Cart invalid');
          done(err);
        });
  });

  it('request shipping rate with invalid cart', function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress,
          cart: invalidCart
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly('Cart invalid');
          done(err);
        });
  });

  it('request shipping rate with over max product quantity cart',
      function(done) {
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress,
          cart: overMaxCart
        })
        .expect(403)
        .end(function(err, res) {
          should(res.body.error.message).be.exactly(
              'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER');
          done(err);
        });
  });

  it('request shipping rate with good cart', function(done) {
    this.timeout(5000);
    request(url)
        .post('/api/store/shipping')
        .send({
          address: goodAddress,
          cart: goodCart
        })
        .expect(200)
        .end(function(err, res) {
          res.body.should.have.property('shipTo');
          res.body.should.have.property('options');
          done(err);
        });
  });

});
