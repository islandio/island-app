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

var MAX_PRODUCT_QUANTITY_PER_ORDER =
    exports.MAX_PRODUCT_QUANTITY_PER_ORDER = 20;

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

  app.post('/api/store/checkout', function (req, res) {
    var token = req.body.token;
    var cart = req.body.cart;
    var shipping = req.body.shipping;
    var description = req.body.description;

    if (!token) {
      return res.send(403, {error: {message: 'Token invalid'}});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.send(403, {error: {message: 'Cart invalid'}});
    }

    if (!shipping || !shipping.shipTo || !shipping.shipments) {
      return res.send(403, {error: {message: 'Shipping invalid'}});
    }

    if (!description) {
      return res.send(403, {error: {message: 'Description invalid'}});
    }

    var products = [];
    var overMaxQuantityPerOrder = [];
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
      if (product.quantity > MAX_PRODUCT_QUANTITY_PER_ORDER) {
        overMaxQuantityPerOrder.push({
          name: product.name,
          requested: product.quantity,
          allowed: MAX_PRODUCT_QUANTITY_PER_ORDER
        });
      }
    });

    if (products.length === 0) {
      return res.send(403, {error: {message: 'Cart invalid'}});
    }

    if (overMaxQuantityPerOrder.length > 0) {
      return res.send(403, {error: {
        message: 'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER',
        data: overMaxQuantityPerOrder
      }});
    }

    Step(
      function () {
        shipwire.stock.get(this);
      },
      function (err, data) {
        if (err) {
          return this(err);
        }

        var stock = {};
        _.each(data.resource.items, function (i) {
          stock[i.resource.sku] = i.resource;
        });

        // Check inventory.
        var unknownProducts = [];
        var insufficientStock = [];
        _.each(products, function (product) {
          var inventory = stock[product.sku];
          if (!inventory) {
            unknownProducts.push({
              name: product.name
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
          return this({error: {code: 403, message: 'UNKNOWN_PRODUCT',
              data: unknownProducts}});
        }

        if (insufficientStock.length > 0) {
          return this({error: {code: 403, message: 'INSUFFICIENT_STOCK',
              data: insufficientStock}});
        }

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
        if (err) {
          return this(err);
        }

        if (!charge.paid || charge.status !== 'succeeded') {
          return this({error: {code: 403, message: 'Payment failed'}});
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

        shipwire.orders.create(order, this);
      },
      function (err, data) {
        if (errorHandler(err, req, res)) return;

        var order = data.resource && data.resource.items &&
            data.resource.items[0] ? data.resource.items[0].resource:
            null;

        if (data.status !== 200 || !order.orderNo || !order.id) {
          return res.send(403, {error: {message: 'Order failed'}});
        }

        res.send({
          message: 'Huzzah! Thank you for your order. We\'ll send an email ' +
              'from sales@island.io to ' + token.email + ' when your order ' +
              'has been received at our warehouse.',
          orderNo: order.orderNo,
          orderId: order.id
        });
      }
    );
  });

  app.post('/api/store/shipping', function (req, res) {
    var address = req.body.address;
    var cart = req.body.cart;

    if (!address || !address.name || !address.address || !address.city ||
        !address.zip || !address.country) {
      return res.send(403, {error: {message: 'Address invalid'}});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.send(403, {error: {message: 'Cart invalid'}});
    }

    var items = [];
    var quantitiesValid = true;
    _.each(cart, function (quantity, sku) {
      if (!store[sku]) {
        return;
      }
      items.push({sku: sku, quantity: quantity});
      if (quantity > MAX_PRODUCT_QUANTITY_PER_ORDER) {
        quantitiesValid = false;
      }
    });

    if (items.length === 0) {
      return res.send(403, {error: {message: 'Cart invalid'}});
    }

    if (!quantitiesValid) {
      return res.send(403, {error: {
          message: 'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER'}});
    }

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
          error: {
            message: 'No shipping options found for the specified address'
          }
        });
      }

      var options = data.resource.rates[0].serviceOptions;
      if (!options || options.length === 0) {
        return res.send(400, {
          error: {
            message: 'No shipping options found for the specified address'
          }
        });
      }

      res.send({shipTo: address, options: options});
    });
  });

  return exports;
};
