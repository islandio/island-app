/*
 * Page view for a member profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'models/member',
  'text!../../templates/profile.html',
  'views/lists/posts'
], function ($, _, Backbone, mps, rpc, util, Member, template, Posts) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#main',

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

      // Use a model for the main content.
      this.model = new Member(this.app.profile.content.page);

      // Set page title
      var title = this.model.get('username');
      if (this.model.get('displayName') !== '')
        title += ' (' + this.model.get('displayName') + ')';
      this.app.title(title);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Set the head meta.
      this.app.head({
        key: this.model.get('username'),
        title: title,
        body: util.rawify(this.model.get('description')),
        medias: this.model.get('image') ?
            [{image: this.model.get('image'), type: 'image'}]: null
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

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
      this.posts.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});