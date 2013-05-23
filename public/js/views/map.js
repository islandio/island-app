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
          navigator.geolocation.getCurrentPosition(_.bind(this.map, this),
              _.bind(this.map, this));
        else this.map();
      }

      // Trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Changes to map display are animated.
      this.$el.addClass('animated');

      // Save DOM refs.
      this.mapInner = this.$('#map_inner');
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

      var opts = {
        zoom: 3,
        minZoom: 5,
        maxZoom: 8
      };

      if (pos && !pos.code) {
        _.extend(opts, {
          center_lat: pos.coords.latitude,
          center_lon: pos.coords.longitude,
          zoom: 8
        });
      }

      // Setup the map.
      this.sql = new cartodb.SQL({user: 'island'});
      cartodb.createVis('map_inner',
          'http://island.cartodb.com/api/v1/viz/crags/viz.json', opts,
          _.bind(function (vis, layers) {
            this.vis = vis;
            this.layers = layers;
            if (!store.get('mapClosed'))
              this.$('.cartodb-zoom').show();
      }, this));
    },

    hideShow: function (e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.hider.text('Hide map');
        this.hider.addClass('split-left');
        this.lesser.show();
        this.$('.cartodb-zoom').fadeIn(300);
        this.resize(250);
        store.set('mapClosed', false);
      } else {
        this.$el.addClass('closed');
        this.hider.text('Show map');
        this.hider.removeClass('split-left');
        this.$('.cartodb-zoom').fadeOut(300);
        this.lesser.hide();
        store.set('mapClosed', true);
      }
    },

    lessMore: function (e) {
      if (this.$el.hasClass('opened')) {
        this.$el.removeClass('opened');
        this.lesser.text('More map');
        this.lesser.addClass('split-right');
        this.hider.show();
        this.resize(250);
      } else {
        this.$el.addClass('opened');
        this.lesser.text('Less map');
        this.lesser.removeClass('split-right');
        this.hider.hide();
        this.resize(600);
      }
    },

    resize: function (height) {
      if (!this.vis) return;
      var sizer = setInterval(_.bind(function () {
        this.vis.mapView.map_leaflet.invalidateSize();
        if (this.$el.height() === height)
          clearInterval(sizer);
      }, this), 20);
    }

  });
});
