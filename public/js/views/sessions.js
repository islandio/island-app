/*
 * Page view for sessions.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'text!../../templates/sessions.html',
  // 'views/lists/sessions',
], function ($, _, Backbone, mps, rpc, util, template, Sessions) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '.main',

    // Module entry point:
    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Set page title
      this.app.title('Sessions');

      // Content rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate'
    },

    // Misc. setup.
    setup: function () {

      // Render lists.
      // this.sessions = new Sessions(this.app, {parentView: this,
      //     reverse: true, input: true});

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      // this.sessions.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});