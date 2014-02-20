/*
 * Page view for a ascent profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/ascent',
  'text!../../templates/ascent.html',
  'text!../../templates/ascent.title.html',
  'views/lists/medias'
], function ($, _, Backbone, mps, rest, util, Ascent, template, title, Medias) {

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

      // Use a model for the main content.
      this.model = new Ascent(this.app.profile.content.page);

      // Set page title.
      this.app.title(this.model.get('name') + ' - ' + [this.model.get('crag'),
          this.model.get('country')].join(', '));
      
      // Render title.
      this.title = _.template(title).call(this);

      // UnderscoreJS rendering.
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

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render lists.
      this.medias = new Medias(this.app, {
        parentView: this,
        reverse: true,
        type: 'ascent'
      });

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
      this.medias.destroy();
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
