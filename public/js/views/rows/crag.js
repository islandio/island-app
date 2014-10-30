/*
 * Crag event View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/crag',
  'text!../../../templates/rows/crag.html',
  'views/lists/comments'
], function ($, _, Backbone, mps, rest, util, Model, template, Comments) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'crag'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model);
      this.parentView = options.parentView;
      this.template = _.template(template);
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click a.navigate': 'navigate',
      // 'click .event-config': '',
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this));
      this.$el.prependTo(this.parentView.$('.event-right'));

      // Render crag location map.
      this.$('.session-map').show();
      var location = this.model.get('location');
      if (location && location.latitude && location.longitude) {
        var table = 'crags' + (window.__s ? '': '_dev');
        cartodb.createVis('crag_map_' + this.model.id,
            'https://island.cartodb.com/api/v1/viz/crags/viz.json', {
          zoom: 8,
          center_lat: location.latitude,
          center_lon: location.longitude,
          zoomControl: false,
          scrollwheel: false,
          cartodb_logo: false,
          https: true
        }, _.bind(function (vis, layers) {}, this));
      } else {
        $('#crag_map_' + this.model.id).text('?');
      }

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'crag',
        hangtenOnly: true
      });

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    when: function () {
      if (!this.model.get('created')) return;
      if (!this.time) {
        this.time = this.$('time.created:first');
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
