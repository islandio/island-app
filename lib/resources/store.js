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

exports.init = function () {
  return this.routes();
};

// "orderNo": "foobar1",
// "externalId": "rFooBar1",
// "processAfterDate": "2014-06-10T16:30:00-07:00",
// # List of items ordered
// "items": [
//     {
//         # Item's SKU
//         "sku": "Laura-s_Pen",
//         # Number of items to order
//         "quantity": 4,
//         # Amount to show in invoice (for customs declaration purposes)
//         "commercialInvoiceValue": 4.5,
//         # Currency for the above value
//         "commercialInvoiceValueCurrency": "USD"
//     },
//     {
//         "sku": "TwinPianos",
//         "quantity": 4,
//         "commercialInvoiceValue": 6.5,
//         "commercialInvoiceValueCurrency": "USD"
//     }
// ],
// "options": {
//     # Specify one of warehouseId, warehouseExternalId, warehouseRegion, warehouseArea
//     "warehouseId": null,
//     "warehouseExternalId": null,
//     "warehouseRegion": "LAX",
//     "warehouseArea": null,
//     # Service requested for this order
//     "serviceLevelCode": "1D",
//     # Delivery carrier requested for this order
//     "carrierCode": null,
//     # Was "Same Day" processing requested?
//     "sameDay": "NOT REQUESTED",
//     # Used to assign a pre-defined set of shipping and/or customization preferences on an order.
//     # A channel must be defined prior to order creation for the desired preferences to be applied.
//     # Please contact us if you believe your application requires a channel.
//     "channelName": "My Channel",
//     "forceDuplicate": 0,
//     "forceAddress": 0,
//     "trialOrder": 0
//     "referrer": "Foo Referrer",
//     "affiliate": null,
//     "currency": "USD",
//     # Specifies whether the items to be shipped can be split into two packages if needed
//     "canSplit": 1,
//     # Set a manual hold
//     "hold": 1,
//     # A discount code
//     "discountCode": "FREE STUFF",
//     "server": "Production"
//     # Process this request asynchronously. Not yet supported (coming soon)
//     "forceAsync": 0,
// },
// # Shipping source
// "shipFrom": {"company": "We Sell'em Co."},
// "shipTo": {
//     # Recipient details
//     "email": "audrey.horne@greatnothern.com",
//     "name": "Audrey Horne",
//     "company": "Audrey's Bikes",
//     "address1": "6501 Railroad Avenue SE",
//     "address2": "Room 315",
//     "address3": "",
//     "city": "Snoqualmie",
//     "state": "WA",
//     "postalCode": "98065",
//     "country": "US",
//     "phone": "4258882556",
//     # Specifies whether the recipient is a commercial entity. 0 = no, 1 = yes
//     "isCommercial": 0,
//     # Specifies whether the recipient is a PO box. 0 = no, 1 = yes
//     "isPoBox": 0
// },
// # Invoiced amounts (for customs declaration only)
// "commercialInvoice": {
//     # Amount for shipping service
//     "shippingValue": 4.85,
//     # Amount for insurance
//     "insuranceValue": 6.57,
//     "additionalValue": 8.29,
//     # Currencies to interpret the amounts above
//     "shippingValueCurrency": "USD",
//     "insuranceValueCurrency": "USD",
//     "additionalValueCurrency": "USD"
// },
// # Message to include in package
// "packingList": {
//     "message1": {
//         "body": "This must be where pies go when they die. Enjoy!",
//         "header": "Enjoy this product!"
//     }
// }

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
          return this({error: 'UNKNOWN_PRODUCT', data: unknownProducts});
        }

        if (insufficientStock.length > 0) {
          return this({error: 'INSUFFICIENT_STOCK', data: insufficientStock});
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

        // CHARGE:
        // { id: 'ch_6u56LMVrBxQwrI',
        //   object: 'charge',
        //   created: 1441122283,
        //   livemode: false,
        //   paid: true,
        //   status: 'succeeded',
        //   amount: 5450,
        //   currency: 'usd',
        //   refunded: false,
        //   source: 
        //    { id: 'card_6u56qpiSdqIozC',
        //      object: 'card',
        //      last4: '4242',
        //      brand: 'Visa',
        //      funding: 'credit',
        //      exp_month: 5,
        //      exp_year: 2016,
        //      fingerprint: 'LkZUSiGpZmaSd9g7',
        //      country: 'US',
        //      name: 'Sander Pick',
        //      address_line1: '3518 Wawona St',
        //      address_line2: null,
        //      address_city: 'San Francisco',
        //      address_state: 'CA',
        //      address_zip: '94116',
        //      address_country: 'United States',
        //      cvc_check: null,
        //      address_line1_check: 'pass',
        //      address_zip_check: 'pass',
        //      tokenization_method: null,
        //      dynamic_last4: null,
        //      metadata: {},
        //      customer: null },
        //   captured: true,
        //   balance_transaction: 'txn_6u56WR1JQAFkEB',
        //   failure_message: null,
        //   failure_code: null,
        //   amount_refunded: 0,
        //   customer: null,
        //   invoice: null,
        //   description: '1 x The Island M1 Classic Brush (7.50), \n1 x The Island M3 Scrub Brush (12.50), \nShipping & Handling (34.50)',
        //   dispute: null,
        //   metadata: { email: 'sanderpick@gmail.com' },
        //   statement_descriptor: '1 X THE ISLAND M',
        //   fraud_details: {},
        //   receipt_email: null,
        //   receipt_number: null,
        //   shipping: null,
        //   destination: null,
        //   application_fee: null,
        //   refunds: 
        //    { object: 'list',
        //      total_count: 0,
        //      has_more: false,
        //      url: '/v1/charges/ch_6u56LMVrBxQwrI/refunds',
        //      data: [] } }

        // var order = {
        //   orderNo: charge.id,
        //   items: [
        //     {
        //       sku: product.sku,
        //       quantity: 1,
        //       commercialInvoiceValue: product.price / 100,
        //       commercialInvoiceValueCurrency: charge.currency.toUpperCase()
        //     }
        //   ],
        //   options: {
        //     warehouseRegion: 'CHI',
        //     warehouseId: 13,
        //     currency: charge.currency.toUpperCase()
        //   },
        //   shipFrom: {
        //     company: 'We Are Island, Inc.'
        //   },
        //   shipTo: {
        //     email: token.email,
        //     name: address.shipping_name,
        //     address1: address.shipping_address_line1,
        //     address2: address.shipping_address_line2,
        //     address3: address.shipping_address_line3,
        //     city: address.shipping_address_city,
        //     state: address.shipping_address_state,
        //     postalCode: address.shipping_address_zip,
        //     country: address.shipping_address_country_code,
        //     isCommercial: 0,
        //     isPoBox: 0
        //   },
        // };
        // console.log(order)
        return res.send();

        // place shipping order
        shipwire.orders.create(order, function (err, data) {
          console.log('shipwire:: ', err, data)
          res.send();
        });
      }
    );
  });

  app.post('/api/store/shipping', function (req, res) {
    var address = req.body.address;
    var cart = req.body.cart;

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
          address2: '',
          address3: '',
          city: address.city,
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
      
      var options = data.resource.rates[0].serviceOptions;
      res.send({options: options});
    });

  });

  // // Read
  // app.get('/api/store/orders/:id', function (req, res) {
  //   shipwire.orders.get(req.body, function (err, order) {
  //     if (errorHandler(err, req, res)) return;
  //     res.send();
  //   });
  // });

  // // Update
  // app.put('/api/store/orders/:id', function (req, res) {
  //   shipwire.orders.update(req.body, function (err, order) {
  //     if (errorHandler(err, req, res)) return;
  //     res.send();
  //   });
  // });

  // // Delete
  // app.delete('/api/store/orders/:id', function (req, res) {
  //   shipwire.orders.cancel(req.body, function (err, order) {
  //     if (errorHandler(err, req, res)) return;
  //     res.send();
  //   });
  // });

  return exports;
};
