/*
 * Page view for a member profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps',
  'util',
  'models/member',
  'views/lists/comments',
  'views/lists/posts'
], function ($, _, Backbone, rpc, mps, util, Member, Comments, Posts) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#main',

    // Module entry point:
    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Subscriptions:
      // this.subscriptions = [
      //   mps.subscribe('currency/investment', _.bind(this.investment, this))
      // ];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Member(this.app.profile.get('content').member);

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, reverse: true});

      // Render posts.
      this.posts = new Posts(this.app, {parentView: this, reverse: true});

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
      this.comments.destroy();
      this.posts.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    // Bind mouse events.
    events: {},

  });
});