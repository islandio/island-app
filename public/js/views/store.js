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
  'views/lists/events',
  'views/lists/ticks'
], function ($, _, Backbone, mps, rest, util, template, title, Events, Ticks) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [
        mps.subscribe('cart/checkout', _.bind(this.checkout, this)),
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
        billingAddress: true,
        shippingAddress: true
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

      this.stripeHandler.open({
        name: 'We Are Island, Inc.',
        description: 'These things...',
        amount: product.price,
        image: this.app.images.store_avatar,
        token: function (token, args) {
          var payload = {
            token: token,
            product: product,
            address: args
          };
          rest.post('/api/store/orders', payload, function (err) {
            console.log('done');
          });
        }
      });
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

    checkout: function () {

      rest.post('/api/store/rate', {}, function (err) {
        console.log('done');
      });

      console.log('checkout.... ')
      return;

      this.stripeHandler.open({
        name: 'We Are Island, Inc.',
        description: 'These things...',
        amount: price,
        // image: product.image,
        token: function (token, args) {
          var payload = {
            token: token,
            // product: product,
            address: args
          };
          rest.post('/api/store/orders', payload, function (err) {
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
