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
      if (location && location.latitude && location.longitude &&
          $('#' + this.$el.attr('id')).length !== 0) {

        // Setup the base map.
        this.sql = new cartodb.SQL({user: 'island', protocol: 'https'});
        this.map = new L.Map(this.$el.attr('id'), {
          center: [location.latitude, location.longitude],
          zoom: 16,
          minZoom: 16,
          maxZoom: 16,
          zoomControl: false
        });

        // Add a base tile layer.
        L.mapbox.accessToken = this.app.mapbox.accessToken;
        L.tileLayer('https://api.mapbox.com/v4/mapbox.streets-satellite/{z}/{x}/{y}.png?access_token=' + L.mapbox.accessToken, {
          attribution: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        // Create the data layer.
        cartodb.createLayer(this.map, {
          user_name: 'island',
          type: 'cartodb',
          cartodb_logo: false,
          extra_params: {
            // map_key: #
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
