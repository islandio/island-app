/*
 * Page view for films.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/store.html',
  'text!../../templates/store.title.html',
  'text!../../templates/shipping.address.html',
  'text!../../templates/shipping.options.html',
  'views/lists/events',
  'views/lists/ticks'
], function ($, _, Backbone, mps, rest, util, template, title, shippingAddress,
      shippingOptions, Events, Ticks) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [
        mps.subscribe('cart/checkout', _.bind(this.getShippingOptions, this)),
        mps.subscribe('cart/empty', _.bind(this.emptyCart, this))
      ];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | Store');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.title = _.template(title).call(this);

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .add-to-cart': 'addToCart',
      'click .buy-now': 'buyNow',
      'click .navigate': 'navigate'
    },

    setup: function () {
      _.defer(function () {
        mps.publish('cart/update');
      });

      this.feed = new Events(this.app, {parentView: this,
          reverse: true, filters: false});
      this.boulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.routes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      this.stripeHandler = StripeCheckout.configure({
        key: this.app.stripe.key,
        billingAddress: false
      });

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.feed.destroy();
      this.boulders.destroy();
      this.routes.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    buyNow: function (e) {
      var button = $(e.target).closest('.buy-now');
      var picker = button.parent();
      var sku = picker.data('sku');

      var product = _.find(this.app.profile.content.products.items,
          function (i) {
        return i.sku === sku;
      });

      if (!product) {
        return;
      }

      return;
    },

    addToCart: function (e) {
      var button = $(e.target).closest('.add-to-cart');
      var picker = button.parent();
      var sku = picker.data('sku');

      var cart = store.get('cart') || {};
      cart[sku] = (cart[sku] || 0) + 1;
      store.set('cart', cart);
      mps.publish('cart/update');
    },

    getShippingOptions: function () {
      $.fancybox(_.template(shippingAddress)({
        member: this.app.profile.member
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Get shipping options for sending the cart items to this address.
        var payload = {
          cart: store.get('cart') || {},
          address: $('.shipping-address-form').serializeObject()
        };
        rest.post('/api/store/shipping', payload, _.bind(function (err, data) {
          
          store.set('shippingOptions', data.options);
          store.set('shipTo', data.shipTo);
          
          $.fancybox.close();
          this.chooseShippingOption();
        }, this));
      }, this));

      return false;
    },

    chooseShippingOption: function () {
      $.fancybox(_.template(shippingOptions)({
        member: this.app.profile.member,
        cart: store.get('cart'),
        address: store.get('address'),
        options: store.get('shippingOptions')
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        var optionCode =
            $('.shipping-options-form input:radio[name="option"]:checked')
            .val();
        var shipping = _.find(store.get('shippingOptions'), function (o) {
          return o.serviceLevelCode === optionCode;
        });
        shipping.shipTo = store.get('shipTo');
        store.set('shipping', shipping);

        $.fancybox.close();
        this.checkout();

      }, this));

      return false;
    },

    checkout: function () {
      var cart = store.get('cart');
      var shipping = store.get('shipping');

      var description = '';
      var total = 0;
      _.each(cart, _.bind(function (quantity, sku) {
        var product = _.find(this.app.profile.content.products.items,
            function (i) {
          return i.sku === sku;
        });
        if (!product) {
          return;
        }
        var cost = quantity * product.price;
        total += cost;
        description += quantity + ' x ' + product.title + ' ($' +
            (cost / 100).toFixed(2) + '), ';
      }, this));

      var shippingAndHandling = shipping.shipments[0].cost.amount * 100;
      total += shippingAndHandling;
      description += 'Shipping & Handling ($' +
          (shippingAndHandling / 100).toFixed(2) + ')';

      this.stripeHandler.open({
        name: 'We Are Island, Inc.',
        description: description,
        amount: total,
        image: this.app.images.store_avatar,
        token: function (token) {
          var payload = {
            token: token,
            cart: cart,
            shipping: shipping,
            description: description
          };
          rest.post('/api/store/checkout', payload, function (err) {
            console.log('done');
          });
        }
      });
    },

    emptyCart: function () {
      store.set('cart', {});
    }

  });
});
