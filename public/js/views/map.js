/*
 * Map view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps'
], function ($, _, Backbone, rpc, mps) {
  return Backbone.View.extend({

    el: '#map',
    mapped: false,

    initialize: function (app) {

      // Save app reference.
      this.app = app;

    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      // Do this once.
      if (!this.mapped) this.map();

      // Done rendering ... trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Shell event.
      this.delegateEvents();

      // Shell listeners / subscriptions.
      // Do this here intead of init ... re-renders often.
      if (this.app.profile && this.app.profile.get('member')) {
        
        // Shell events.
        this.app.profile.on('change:portfolio', _.bind(this.update, this));
        
        // Shell subscriptions:
        this.subscriptions = [
          // mps.subscribe('topic', _.bind(this.fn, this)),
        ];

      }
    },

    // Bind mouse events.
    events: {},

    map: function () {
      this.mapped = true;

      // Setup the map.
      this.sql = new cartodb.SQL({user: 'island'});
      cartodb.createVis('map',
        'http://island.cartodb.com/api/v1/viz/crags/viz.json', {
        // center_lat: crag.data('lat'),
        // center_lon: crag.data('lon'),
        zoom: 3
      }, function (vis, layers) {});

    }

  });
});
