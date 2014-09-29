/*
 * Page view for the about page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/about.html',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, util, template,
    Followers, Followees, Watchees) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | About');
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    setup: function () {

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

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
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
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
