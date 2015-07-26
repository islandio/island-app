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
      this.subscriptions = [];
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
      'click .picker-up': 'addItem',
      'click .picker-down': 'removeItem',
      'click .add-to-cart': 'addToCart',
      'click .navigate': 'navigate'
    },

    setup: function () {
      this.feed = new Events(this.app, {parentView: this,
          reverse: true, filters: false});
      this.boulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.routes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      var handler = StripeCheckout.configure({
        key: this.app.stripe.key,
        billingAddress: true,
        shippingAddress: true
      });

      _.each(this.app.profile.content.products.items, function (product) {
        $('#' + product.sku).on('click', function (e) {
          handler.open({
            name: 'We Are Island, Inc.',
            description: product.name + ' - ' + product.description,
            amount: product.price,
            image: product.image,
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
          e.preventDefault();
        });
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

    addItem: function (e) {

    },

    removeItem: function (e) {

    },

    addToCart: function (e) {
      
    }

  });
});
