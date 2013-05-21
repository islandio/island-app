/*
 * Map view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc'
], function ($, _, Backbone, Modernizr, mps, rpc) {
  return Backbone.View.extend({

    el: '#map',
    mapped: false,

    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      // Do this once.
      if (!this.mapped) {
        var page = this.app.profile.get('content').page;
        var loc = page ? page.location: null;
        if (loc && loc.latitude && loc.longitude) this.map({coords: loc});
        else if (Modernizr.geolocation)
          navigator.geolocation.getCurrentPosition(_.bind(this.map, this));
        else this.map();
      }

      // Trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Save DOM refs.
      this.hider = this.$('#hide_show');
      this.lesser = this.$('#less_more');

      // Shell event.
      this.delegateEvents();
    },

    // Bind mouse events.
    events: {
      'click #hide_show': 'hideShow',
      'click #less_more': 'lessMore',
    },

    map: function (pos) {
      this.mapped = true;

      var opts = {zoom: 3};
      if (pos) {
        opts.center_lat = pos.coords.latitude;
        opts.center_lon = pos.coords.longitude;
        opts.zoom = 8;
      }

      // Setup the map.
      this.sql = new cartodb.SQL({user: 'island'});
      cartodb.createVis('map_inner',
          'http://island.cartodb.com/api/v1/viz/crags/viz.json', opts,
          function (vis, layers) {});
    },

    hideShow: function (e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.hider.text('Hide map');
        this.hider.addClass('split-left');
        this.lesser.show();
      } else {
        this.$el.addClass('closed');
        this.hider.text('Show map');
        this.hider.removeClass('split-left');
        this.lesser.hide();
      }
      $(window).resize();
    },

    lessMore: function (e) {
      if (this.$el.hasClass('opened')) {
        this.$el.removeClass('opened');
        this.lesser.text('More map');
        this.lesser.addClass('split-right');
        this.hider.show();
      } else {
        this.$el.addClass('opened');
        this.lesser.text('Less map');
        this.lesser.removeClass('split-right');
        this.hider.hide();
      }
      $(window).resize();
    }

  });
});
