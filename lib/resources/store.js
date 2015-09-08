/*
 * store.js: Handles orders from the store.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');
var Step = require('step');
var store = require('../../store.json');

var MAX_PRODUCT_QUANTITY_PER_ORDER = 5;

exports.init = function () {
  return this.routes();
};

exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');
  var emailer = app.get('emailer');
  var stripe = app.get('stripe');
  var sendowl = app.get('sendowl');
  var shipwire = app.get('shipwire');

  // Create
  app.post('/api/store/checkout', function (req, res) {
    var token = req.body.token;
    var cart = req.body.cart;
    var shipping = req.body.shipping;
    var description = req.body.description;

    if (!token) {
      return res.send(403, {error: 'Token invalid'});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.send(403, {error: 'Cart invalid'});
    }

    if (!shipping || !shipping.shipTo || !shipping.shipments) {
      return res.send(403, {error: 'Shipping invalid'});
    }

    if (!description) {
      return res.send(403, {error: 'Description invalid'});
    }

    // Validate products' price.
    var products = [];
    var amount = shipping.shipments[0].cost.amount * 100;
    _.each(cart, function (quantity, sku) {
      if (!store[sku]) {
        return;
      }
      var product = {
        sku: sku,
        quantity: quantity,
        name: store[sku].name,
        price: store[sku].price
      };
      products.push(product);
      amount += (quantity * product.price);
    });

    Step(
      function () {
        shipwire.stock.get(this);
      },
      function (err, data) {
        if (errorHandler(err, req, res)) return;
        var stock = {};
        _.each(data.resource.items, function (i) {
          stock[i.resource.sku] = i.resource;
        });

        // Check inventory.
        var unknownProducts = [];
        var insufficientStock = [];
        var overMaxQuantityPerOrder = [];
        _.each(products, function (product) {
          var inventory = stock[product.sku];
          if (!inventory) {
            unknownProducts.push({
              name: product.name
            });
          } else if (product.quantity > MAX_PRODUCT_QUANTITY_PER_ORDER) {
            overMaxQuantityPerOrder.push({
              name: product.name,
              requested: product.quantity,
              allowed: MAX_PRODUCT_QUANTITY_PER_ORDER
            });
          } else if (inventory.good < product.quantity) {
            insufficientStock.push({
              name: product.name,
              requested: product.quantity,
              good: inventory.good
            });
          }
        });

        if (unknownProducts.length > 0) {
          return this({error: {message:'UNKNOWN_PRODUCT',
              data: unknownProducts}});
        }

        if (overMaxQuantityPerOrder.length > 0) {
          return this({error: {message: 'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER',
              data: overMaxQuantityPerOrder}});
        }

        if (insufficientStock.length > 0) {
          return this({error: {message: 'INSUFFICIENT_STOCK',
              data: insufficientStock}});
        }

        // Charge card.
        stripe.charges.create({
          amount: amount,
          currency: 'usd',
          source: token.id,
          description: description,
          metadata: {
            email: token.email
          },
          statement_descriptor: _.prune(description, 22, '').toUpperCase()
        }, this);
      },
      function (err, charge) {
        if (errorHandler(err, req, res)) return;

        if (!charge.paid || charge.status !== 'succeeded') {
          return res.send(403, { // TODO: check this
            error: {message: 'Payment failed'}
          });
        }

        var items = _.map(products, function (product) {
          return {
            sku: product.sku,
            quantity: product.quantity,
            commercialInvoiceValue: product.price / 100,
            commercialInvoiceValueCurrency: charge.currency.toUpperCase()
          };
        });

        var order = {
          orderNo: charge.id,
          items: items,
          options: {
            warehouseRegion: 'CHI',
            warehouseId: 13,
            currency: charge.currency.toUpperCase()
          },
          shipFrom: {
            company: 'We Are Island, Inc.'
          },
          shipTo: {
            email: token.email,
            name: shipping.shipTo.name,
            address1: shipping.shipTo.address,
            city: shipping.shipTo.city,
            state: shipping.shipTo.state,
            postalCode: shipping.shipTo.zip,
            country: shipping.shipTo.country,
            isCommercial: 0,
            isPoBox: 0
          },
          packingList: {
            message1: {
              body: '- The Island Team',
              header: 'Thank you for your order.'
            }
          }
        };

        // Place shipping order.
        shipwire.orders.create(order, this);
      },
      function (err, data) {
        if (errorHandler(err, req, res)) return;

        if (data.status !== 200) {
          return res.send(403, {
            error: {message: 'Order failed'}
          });
        }

        res.send({
          message: 'Huzzah! Thank you for your order. Lookout for an email ' +
              'from sales@island.io.'
        });
      }
    );
  });

  app.post('/api/store/shipping', function (req, res) {
    var address = req.body.address;
    var cart = req.body.cart;

    if (!address) {
      return res.send(403, {error: 'Address invalid'});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.send(403, {error: 'Cart invalid'});
    }

    var items = _.map(cart, function (quantity, sku) {
      return {sku: sku, quantity: quantity};
    });

    var params = {
      options: {
        currency: 'USD',
        groupBy: 'all',
        canSplit: 0,
        warehouseArea: 'US'
      },
      order: {
        shipTo: {
          address1: address.address,
          city: address.city,
          state: address.state,
          postalCode: address.zip,
          country: address.country,
          isCommercial: 0,
          isPoBox: 0
        },
        items: items
      }
    };

    shipwire.rate.get(params, function (err, data) {
      if (errorHandler(err, req, res)) return;
      if (data.errors && data.errors.length > 0) {
        return res.send(data.status, {
          error: {message: data.errors[0].message}
        });
      }

      var warnings = data.warnings;
      if (warnings && warnings.length > 0) {
        return res.send(400, {
          error: {message: warnings[0].message}
        });
      }

      var rates = data.resource.rates;
      if (!rates || rates.length === 0) {
        return res.send(400, {
          error: {message: 'No shipping options found for the specified address'}
        });
      }

      var options = data.resource.rates[0].serviceOptions;
      if (!options || options.length === 0) {
        return res.send(400, {
          error: {message: 'No shipping options found for the specified address'}
        });
      }

      res.send({shipTo: address, options: options});
    });
  });

  return exports;
};
