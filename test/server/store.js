var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');
var store = require('../../lib/resources/store');
var skus = Object.keys(require('../../store.json'));
var config = require('../../config.json');

var stripe = require('stripe')(config.STRIPE_SECRET_KEY);

var shipwire = new (require('shipwire-node').Shipwire)({
  host: config.SHIPWIRE_HOST,
  username: config.SHIPWIRE_USER,
  password: config.SHIPWIRE_PASS
});

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
  name: 'TEST GUY',
  address: '530 N Montana Ave',
  city: 'Bozeman',
  state: 'MT',
  zip: '59715',
  country: 'United States'
};

var invalidCart = {'Not-A-Real-SKU': 3};

var overMaxCart = {'M3-Island-Brush': store.MAX_PRODUCT_QUANTITY_PER_ORDER + 1};

var outOfStockCart = {'TEST-NO-STOCK': 10};

var goodCart = {'M1-Island-Brush': 1};

var invalidToken = {id: 'canihazdollarbills'};

var goodToken;

var shipping = {
  serviceLevelCode: 'GD',
  serviceLevelName: 'Ground',
  shipTo: goodAddress,
  shipments: [
    {
      carrier: {
        code: 'USPS FC',
        name: 'USPS',
        description: 'USPS First-Class Mail Parcel + Delivery Confirmation',
        properties: [
          'deliveryConfirmation'
        ]
      },
      cost: {
        currency: 'USD',
        type: 'total',
        name: 'Total',
        amount: 3.54,
        converted: false,
        originalCost: 3.54,
        originalCurrency: 'USD'
      },
      expectedDeliveryMaxDate: '2015-09-24T23:30:00-07:00',
      expectedDeliveryMinDate: '2015-09-21T23:30:00-07:00',
      expectedShipDate: '2015-09-18T01:30:00-05:00',
      pieces: [
        {
          contents: [
            {
              quantity: 1,
              sku: 'M1-Island-Brush'
            }
          ],
          height: {
            amount: 0.7,
            units: 'in'
          },
          length: {
            amount: 9.5,
            units: 'in'
          },
          subweights: [
            {
              amount: 0.05,
              type: 'packaging',
              units: 'lbs'
            },
            {
              amount: 0,
              type: 'voidFill',
              units: 'lbs'
            },
            {
              amount: 0.1,
              type: 'products',
              units: 'lbs'
            }
          ],
          weight: {
            amount: 0.15,
            type: 'total',
            units: 'lbs'
          },
          width: {
            amount: 5.5,
            units: 'in'
          }
        }
      ],
      subtotals: [
        {
          amount: 2.79,
          converted: false,
          currency: 'USD',
          name: 'Shipping',
          originalCost: 2.79,
          originalCurrency: 'USD',
          type: 'shipping'
        },
        {
          amount: 0.75,
          converted: false,
          currency: 'USD',
          name: 'Insurance',
          originalCost: 0.75,
          originalCurrency: 'USD',
          type: 'insurance'
        },
        {
          amount: 0,
          converted: false,
          currency: 'USD',
          name: 'Packaging',
          originalCost: 0,
          originalCurrency: 'USD',
          type: 'packaging'
        },
        {
          amount: 0,
          converted: false,
          currency: 'USD',
          name: 'Handling',
          originalCost: 0,
          originalCurrency: 'USD',
          type: 'handling'
        }
      ],
      warehouseName: 'Chicago'
    }
  ]
};

var description = 'TEST ' + Date.now();

describe('Store', function() {

  describe('Shipping Rates', function() {

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
            cart: {}
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

  describe('Stripe.js', function() {

    it('stripe token create', function(done) {
      this.timeout(5000);
      stripe.tokens.create({
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2016,
          cvc: '123'
        }
      }, function (err, token) {
        token.should.have.property('id');
        goodToken = token;
        done(err);
      });
    });

  });

  after(function () {

    describe('Checkout', function() {

      it('checkout with no stripe token', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              cart: goodCart,
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Token invalid');
              done(err);
            });
      });

      it('checkout with no cart', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Cart invalid');
              done(err);
            });
      });

      it('checkout with empty cart', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: {},
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Cart invalid');
              done(err);
            });
      });

      it('checkout with no shipping', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: goodCart,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Shipping invalid');
              done(err);
            });
      });

      it('checkout with no shipping address', function(done) {
        var _shipping = _.clone(shipping);
        delete _shipping.shipTo;
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: goodCart,
              shipping: _shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Shipping invalid');
              done(err);
            });
      });

      it('checkout with no shipment', function(done) {
        var _shipping = _.clone(shipping);
        delete _shipping.shipments;
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: goodCart,
              shipping: _shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Shipping invalid');
              done(err);
            });
      });

      it('checkout with no description', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: goodCart,
              shipping: shipping
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Description invalid');
              done(err);
            });
      });

      it('checkout with over max product quantity cart', function(done) {
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: overMaxCart,
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly(
                  'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER');
              done(err);
            });
      });

      it('checkout with unknown product', function(done) {
        this.timeout(5000);
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: invalidCart,
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('Cart invalid');
              done(err);
            });
      });

      it('checkout with insufficient stock', function(done) {
        this.timeout(5000);
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: outOfStockCart,
              shipping: shipping,
              description: description
            })
            .expect(403)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly('INSUFFICIENT_STOCK');
              done(err);
            });
      });

      it('checkout with invalid token', function(done) {
        this.timeout(5000);
        request(url)
            .post('/api/store/checkout')
            .send({
              token: invalidToken,
              cart: goodCart,
              shipping: shipping,
              description: description
            })
            .expect(500)
            .end(function(err, res) {
              should(res.body.error.message).be.exactly(
                  'No such token: canihazdollarbills');
              done(err);
            });
      });

      it('checkout with valid token', function(done) {
        this.timeout(60000);
        request(url)
            .post('/api/store/checkout')
            .send({
              token: goodToken,
              cart: goodCart,
              shipping: shipping,
              description: description
            })
            .expect(200)
            .end(function(err, res) {
              res.body.should.have.property('orderNo');
              res.body.should.have.property('orderId');

              shipwire.orders.cancel({id: res.body.orderId},
                  function (err, data) {
                should(data.status).be.exactly(200);
                should(data.message).be.exactly('Order cancelled');
                done(err);
              });
            });
      });

    });

  });

});
