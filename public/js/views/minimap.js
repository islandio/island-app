/*
 * Minimap View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/carto/crags.css'
], function ($, _, Backbone, mps, rest, util, css) {
  return Backbone.View.extend({

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.cssTemplate = _.template(css);
      this.setElement(options.el);
      return this;
    },

    render: function () {
      this.$el.show();
      var location = this.options.location;
      if (location && location.latitude && location.longitude
          && $('#' + this.$el.attr('id')).length !== 0) {

        // Setup the base map.
        this.sql = new cartodb.SQL({user: 'island',
            api_key: this.app.cartodb.apiKey, protocol: 'https'});
        this.map = new L.Map(this.$el.attr('id'), {
          center: [location.latitude, location.longitude],
          zoom: 8,
          minZoom: 8,
          maxZoom: 8,
          zoomControl: false
        });

        // Add a base tile layer.
        // http://1.maps.nlp.nokia.com/maptile/2.1/maptile/newest/terrain.day/{LOD}/{X}/{Y}/256/png?app_code=INSERT_LICENCE_TOKEN_HERE&app_id=INSERT_APP_ID_HERE
        L.tileLayer('https://{s}.maps.nlp.nokia.com/maptile/2.1/' +
            'maptile/{mapID}/{variant}/{z}/{x}/{y}/256/png8?' +
            'app_id={app_id}&app_code={app_code}', {
          attribution:
              'Map &copy; 1987-2014 <a href="http://developer.here.com">HERE</a>',
          subdomains: '1234',
          mapID: 'newest',
          'app_id': 'PvVIz1964Y3C1MabyVqB',
          'app_code': 'yuYSbxg5Z5b2c594mYfLtA',
          base: 'base',
          variant: 'terrain.day',
          minZoom: 0,
          maxZoom: 20
        }).addTo(this.map);

        // Create the data layer.
        cartodb.createLayer(this.map, {
          user_name: 'island',
          type: 'cartodb',
          cartodb_logo: false,
          extra_params: {
            map_key: this.app.cartodb.apiKey
          },
          sublayers: [{
            sql: this.app.cartodb.sqlPre,
            cartocss: this.cssTemplate.call(this),
          }]
        }, {https: true}).addTo(this.map).done(_.bind(function (layer) {
          _.defer(_.bind(function () {
            this.map.invalidateSize();
          }, this));
        }, this));
      } else {
        this.$el.text('?');
      }

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    }

  });
});
