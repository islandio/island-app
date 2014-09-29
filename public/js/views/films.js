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
  'views/lists/events',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, rest, util, template, Events,
    Followers, Followees, Watchees) {

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
      this.app.title('Island | Films');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
    },

    // Misc. setup.
    setup: function () {

      // Render events.
      this.events = new Events(this.app, {parentView: this,
          reverse: true, filters: false});

      // Render lists.
      this.followers = new Followers(this.app, {parentView: this, reverse: true});
      this.followees = new Followees(this.app, {parentView: this, reverse: true});
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.routes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.boulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

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
      this.events.destroy();
      this.followers.destroy();
      this.followees.destroy();
      this.crags.destroy();
      this.routes.destroy();
      this.boulders.destroy();
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
