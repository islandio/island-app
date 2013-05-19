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
      if (!this.mapped)
        if (Modernizr.geolocation)
          navigator.geolocation.getCurrentPosition(_.bind(this.map, this));
        else this.map();

      // Trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Shell event.
      this.delegateEvents();
    },

    // Bind mouse events.
    events: {},

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
      cartodb.createVis('map',
          'http://island.cartodb.com/api/v1/viz/crags/viz.json', opts,
          function (vis, layers) {});
    }

  });
});
