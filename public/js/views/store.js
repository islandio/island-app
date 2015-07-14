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
  'views/lists/events',
  'views/lists/ticks'
], function ($, _, Backbone, mps, rest, util, template, Events, Ticks) {

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

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    setup: function () {
      this.feed = new Events(this.app, {parentView: this,
          reverse: true, filters: false});
      this.boulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.routes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      _.each(this.app.profile.content.products.items, function (p) {
        var handler = StripeCheckout.configure({
          key: 'pk_test_6pRNASCoBOKtIshFeQd4XMUh',
          name: p.name,
          description: p.description,
          amount: p.price,
          image: p.image,
          token: function(token) {
            console.log(token)
          }
        });

        $('#' + p.sku).on('click', function (e) {
          handler.open();
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

  });
});
