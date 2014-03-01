/*
 * Page view for the about page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'util',
  'mps',
  'rest',
  'text!../../templates/tabs.html'
], function ($, _, Backbone, mps, util, rest, template) {

  return Backbone.View.extend({

    // The DOM target element for this page.
    el: '.tabs',
    working: false,

    // Module entry point.
    initialize: function (app, params) {
      this.app = app;
      this.params = params || {};

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {
      if (!this.params.tabs) this.params.tabs = [];

      // Render or activate tabs.
      if (!this.params.tabs || this.params.tabs.length === 0)
        this.empty();
      var tabs = this.$('.tab');
      if (tabs.length === 0) {
        this.template = _.template(template);
        this.$el.html(this.template.call(this));
      } else {
        var i = -1;
        _.find(this.params.tabs, function (t) {
          ++i;
          return t.active;
        });
        tabs.removeClass('active');
        this.$('.tab:eq(' + i + ')').addClass('active');
      }

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
      'click .follow-button': 'follow',
      'click .unfollow-button': 'unfollow'
    },

    // Misc. setup.
    setup: function () {
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

    follow: function (e) {
      var btn = $(e.target).closest('a');

      // Prevent multiple requests.
      if (this.working || !this.app.profile.content.page) return false;
      this.working = true;

      // Do the API request.
      var username = this.app.profile.content.page.username;
      rest.post('/api/members/' + username + '/follow', {},
          _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Update button content.
        btn.removeClass('follow-button').addClass('unfollow-button')
            .html('<i class="icon-user-delete"></i> Unfollow');

      }, this));

      return false;  
    },

    unfollow: function (e) {
      var btn = $(e.target).closest('a');

      // Prevent multiple requests.
      if (this.working || !this.app.profile.content.page) return false;
      this.working = true;

      // Do the API request.
      var username = this.app.profile.content.page.username;
      rest.post('/api/members/' + username + '/unfollow', {},
          _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Update button content.
        btn.removeClass('unfollow-button').addClass('follow-button')
            .html('<i class="icon-user-add"></i> Follow');

      }, this));

      return false;  
    },

  });
});
