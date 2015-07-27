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
  app.post('/api/store/orders', function (req, res) {
    var token = req.body.token;
    var product = req.body.product;
    var address = req.body.address;
    
    // check inventory...
    // charge card
    // create shipping order

    shipwire.stock.get(function (err, data) {
      if (errorHandler(err, req, res)) return;

      

      stripe.charges.create({
        amount: product.price,
        currency: 'usd',
        source: token.id,
        description: product.name + '-' + product.description,
        metadata: {
          email: token.email
        },
        statement_descriptor: product.name.toUpperCase()
      }, function (err, charge) {
        if (errorHandler(err, req, res)) return;

        if (!charge.paid || charge.status !== 'succeeded') {
          return res.send(403, { // TODO: check this
            error: {message: 'Payment failed'}
          });
        }

        var order = {
          orderNo: charge.id,
          items: [
            {
              sku: product.sku,
              quantity: 1,
              commercialInvoiceValue: product.price/100,
              commercialInvoiceValueCurrency: charge.currency.toUpperCase()
            }
          ],
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
            name: address.shipping_name,
            address1: address.shipping_address_line1,
            address2: address.shipping_address_line2,
            address3: address.shipping_address_line3,
            city: address.shipping_address_city,
            state: address.shipping_address_state,
            postalCode: address.shipping_address_zip,
            country: address.shipping_address_country_code,
            isCommercial: 0,
            isPoBox: 0
          },
        };
        console.log(order)
        // return res.send();

        // place shipping order
        shipwire.orders.create(order, function (err, data) {
          console.log('shipwire:: ', err, data)
          res.send();
        });
      });

    });
  });

  app.post('/api/store/rate', function (req, res) {
    var products = req.body.products;
    var address = req.body.address;

    var params = {
      options: {
        currency: 'USD',
        groupBy: 'all',
        canSplit: 0,
        warehouseArea: 'US'
      },
      order: {
        shipTo: {
          address1: '5811 Sypes Canyon Road',
          address2: '',
          address3: '',
          city: 'Bozeman',
          postalCode: '59715',
          region: 'MT',
          country: 'US',
          isCommercial: 0,
          isPoBox: 0
        },
        items: [
          {
            sku: 'M1-Island-Brush',
            quantity: 1
          },
          {
            sku: 'M3-Island-Brush',
            quantity: 2
          }
        ]
      }
    };

    shipwire.rate.get(params, function (err, data) {
      console.log('shipwire:: ', err, JSON.stringify(data))
      res.send();
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
