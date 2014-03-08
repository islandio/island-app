/*
 * Page view for crags.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/crags.html',
  'text!../../templates/crags.list.html'
], function ($, _, Backbone, mps, rest, util, template, list) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '.main',
    str: null,
    num: 0,

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
      this.app.title('Island | Crags');

      // Content rendering.
      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');
      this.list = _.template(list);

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

      // Save refs.
      this.input = this.$('.crags-search-input input');
      this.results = this.$('.list-wrap').show();
      this.noresults = this.$('.no-results');

      // Handle filtering.
      this.input.bind('keyup search', _.bind(this.search, this));

      // Focus.
      if (!$('.header-search .search-display').is(':visible'))
        this.input.focus();

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

    searchVal: function () {
      var str = util.sanitize(this.input.val());
      return str === '' || str.length < 2 ? null: str;
    },

    search: function (e) {
      this.noresults.hide();

      // Clean search string.
      var str = this.searchVal();
      var query = {};

      // Handle interaction.
      if (str && str === this.str) {
        if (this.num === 0)
          this.noresults.show();
        return false;
      }
      this.str = str;
      $('.list', this.results).remove();
      if (!str) return false;

      // Check for country code filter.
      if (str.indexOf(':') === 3) {
        var parts = str.split(':');
        query.country_key = parts[0].trim();
        str = parts[1].trim();
      }
      if (str === '' || str.length < 2)
        return false;

      // Call server.
      rest.post('/api/crags/search/' + str, query,
          _.bind(function (err, data) {
        if (err) return console.log(err);
        this.num = data.items.length;
        if (data.items.length === 0)
          return this.noresults.show();

        // Render results.
        $(this.list.call(this, data)).appendTo(this.results);
      }, this));

      return false;
    }

  });
});
