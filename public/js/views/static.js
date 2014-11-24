/*
 * Page view for a static page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util'
], function ($, _, Backbone, mps, util) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | ' + this.options.title);

      this.template = _.template(this.options.template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    setup: function () {
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
