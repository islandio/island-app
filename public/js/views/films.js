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
  'text!../../templates/films.html',
  'views/lists/events'
], function ($, _, Backbone, mps, rest, util, template, Events) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {

      this.app.title('Island | Films');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    setup: function () {

      // Render events.
      this.events = new Events(this.app, {parentView: this,
          reverse: true, filters: false});

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
      this.events.destroy();
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
