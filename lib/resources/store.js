/*
 * store.js: Handles orders from the store.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('@islandio/util');
var _ = require('underscore');
var _s = require('underscore.string');
var profiles = require('@islandio/collections').profiles;
var app = require('../../app');
var Step = require('step');
var store = require('../../store.json');

var dateFormat = iutil.dateFormat;

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
      return res.status(403).send({error: {message: 'Token invalid'}});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.status(403).send({error: {message: 'Cart invalid'}});
    }

    if (!shipping || !shipping.shipTo || !shipping.shipments ||
        !shipping.shipments[0]) {
      return res.status(403).send({error: {message: 'Shipping invalid'}});
    }

    if (!description) {
      return res.status(403).send({error: {message: 'Description invalid'}});
    }

    var shipment = shipping.shipments[0];
    var products = [];
    var overMaxQuantityPerOrder = [];
    var amount = shipment.cost.amount * 100;
    var totalQuantity = 0;
    _.each(cart, function (quantity, sku) {
      if (!store[sku] || quantity === null) {
        return;
      }
      var product = {
        sku: sku,
        quantity: quantity,
        name: store[sku].name,
        title: store[sku].title,
        price: store[sku].price
      };
      products.push(product);
      amount += (quantity * product.price);
      totalQuantity += quantity;
    });

    if (products.length === 0) {
      return res.status(403).send({error: {message: 'Cart invalid'}});
    }

    if (totalQuantity > 20) {
      return res.status(403).send({error: {
        message: 'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER'
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
          statement_descriptor: _s.prune(description, 22, '').toUpperCase()
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
            currency: charge.currency.toUpperCase(),
            serviceLevelCode: shipping.serviceLevelCode,
            carrierCode: shipment.carrier.code
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
              body: '- Thank you for supporting Island. Try hard out there!',
              header: ''
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
          return res.status(403).send({error: {message: 'Order failed'}});
        }

        res.send({
          message: 'Huzzah! Thank you for supporting Island. ' +
              'Your order (' + order.orderNo + ') is expected to arrive by ' +
              dateFormat(new Date(shipment.expectedDeliveryMaxDate), 'm/d') +
              '. A confirmation email was sent to ' + token.email + '.',
          orderNo: order.orderNo,
          orderId: order.id
        });

        if (process.env.NODE_ENV === 'production') {
          var email = {
            to: token.email,
            from: 'Island <sales@island.io>',
            subject: 'Your Island order confirmation (' + order.orderNo + ')'
          };
          email.text = 'Hi ' + shipping.shipTo.name + ',';
          email.text += '\n\n';
          email.text += 'Thank you for placing your order with Island!';
          email.text += '\n\n';
          email.text += 'This email is to confirm your recent order:';
          email.text += '\n\n';

          _.each(products, function (product) {
            email.text += product.quantity + ' x ' + product.title;
            email.text += ' (' + product.sku + ')';
            email.text += '\n';
          });

          email.text += '\n';
          email.text += 'This shipment will be sent to:';
          email.text += '\n\n';

          email.text += shipping.shipTo.name;
          email.text += '\n';
          email.text += shipping.shipTo.address;
          email.text += '\n';
          email.text += shipping.shipTo.city + ', ' + shipping.shipTo.state +
              ' ' + shipping.shipTo.zip;
          email.text += '\n';
          email.text += shipping.shipTo.country;
          email.text += '\n\n';

          email.text += 'Shipping method: ' + shipping.serviceLevelName + ' (' +
              shipment.carrier.description + ')';
          email.text += '\n';
          email.text += 'Expected ship date: ' +
              dateFormat(new Date(shipment.expectedShipDate), 'dddd, d mmmm');
          email.text += '\n';
          email.text += 'Expected delivery date: ' +
              dateFormat(new Date(shipment.expectedDeliveryMaxDate),
              'dddd, d mmmm');
          email.text += '\n\n';

          email.text += 'You will receive another email when your order ships.';
          email.text += '\n\n';

          email.text += 'Thank you for supporting Island. Try hard out there!';
          email.text += '\n\n';
          email.text += 'Cheers,';
          email.text += '\n';
          email.text += 'Island Team';

          emailer.send(email);
        }
      }
    );
  });

  app.post('/api/store/shipping', function (req, res) {
    var address = req.body.address;
    var cart = req.body.cart;

    if (!address || !address.name || !address.address || !address.city ||
        !address.zip || !address.country) {
      return res.status(403).send({error: {message: 'Address invalid'}});
    }

    if (!cart || _.isEmpty(cart)) {
      return res.status(403).send({error: {message: 'Cart invalid'}});
    }

    var items = [];
    var totalQuantity = 0;
    _.each(cart, function (quantity, sku) {
      if (!store[sku] || quantity === null) {
        return;
      }
      items.push({sku: sku, quantity: quantity});
      totalQuantity += quantity;
    });

    if (items.length === 0) {
      return res.status(403).send({error: {message: 'Cart invalid'}});
    }

    if (totalQuantity > 20) {
      return res.status(403).send({error: {
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
        return res.status(data.status).send({
          error: {message: data.errors[0].message}
        });
      }

      var warnings = data.warnings;
      if (warnings && warnings.length > 0) {
        return res.status(400).send({
          error: {message: warnings[0].message}
        });
      }

      var rates = data.resource.rates;
      if (!rates || rates.length === 0) {
        return res.status(400).send({
          error: {
            message: 'No shipping options found for the specified address'
          }
        });
      }

      var options = data.resource.rates[0].serviceOptions;
      if (!options || options.length === 0) {
        return res.status(400).send({
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
