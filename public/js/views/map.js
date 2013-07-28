/*
 * Map view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc',
  'text!../../../templates/popup.html',
  'Spin'
], function ($, _, Backbone, Modernizr, mps, rpc, popup, Spin) {
  return Backbone.View.extend({

    el: '#map',
    mapped: false,
    markers: {},

    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions.
      this.subscriptions = [];

      // Socket subscriptions.
      this.app.socket.subscribe('map').bind('instagram.new',
          _.bind(this.getMarkers, this, false));
    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      // Listen for fly to requests.
      this.subscriptions.push(mps.subscribe('map/fly',
          _.bind(this.fly, this)));

      // Get a geocoder.
      if (!this.geocoder)
        this.geocoder = new google.maps.Geocoder();

      // Init the load indicator.
      if (!this.spin)
        this.spin = new Spin(this.$('#map_spin'), {
          color: '#b3b3b3',
          lines: 17,
          length: 12,
          width: 4,
          radius: 18
        });

      // Create the map.
      if (!this.mapped) {
        if (!this.$el.hasClass('closed'))
          this.spin.start();
        if (Modernizr.geolocation)
          navigator.geolocation.getCurrentPosition(_.bind(this.map, this),
              _.bind(this.map, this), {maximumAge:60000, timeout:5000, 
                enableHighAccuracy:true});
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
      'click #less_more': 'lessMore'
    },

    map: function (pos) {
      this.mapped = true;

      var opts = {
        zoom: 3,
        scrollwheel: false,
        https: true
      };

      if (pos && !pos.code) {
        _.extend(opts, {
          center_lat: pos.coords.latitude,
          center_lon: pos.coords.longitude,
          zoom: 7
        });
      }

      // Setup the map.
      this.sql = new cartodb.SQL({user: 'island'});
      cartodb.createVis('map_inner',
          'http://island.cartodb.com/api/v1/viz/crags/viz.json', opts,
          _.bind(function (vis, layers) {
        this.vis = vis;
        this.vis.mapView.map_leaflet.options.maxZoom = 17;
        this.vis.mapView.map_leaflet.options.minZoom = 3;
        this.layers = layers;
        this.spin.stop();

        // Handle infowindows.
        layers[1].infowindow.set('template', _.template(popup).call(this));

        layers[1].on('featureClick', _.bind(function (e, pos, latlng, data) {
          _.delay(_.bind(function () {
            $('a.popup-link').click(_.bind(function (e) {
              e.preventDefault();

              // Route to crag.
              this.app.router.navigate($(e.target).closest('a').attr('href'), {trigger: true});
            }, this));
          }, this), 500);
        }, this));

        // Init events for markers.
        this.vis.mapView.map_leaflet.on('zoomend', 
            _.bind(this.getMarkers, this, true));
        this.vis.mapView.map_leaflet.on('moveend', 
            _.bind(this.getMarkers, this, false));

        // Hide the zoomer if the map is hidden.
        if (!store.get('mapClosed'))
          this.$('.cartodb-zoom').show();

        // Get the markers.
        this.getMarkers(true);

        // Fly to a location if there is one pending.
        if (this.pendingLocation) this.fly(this.pendingLocation);

      }, this));
    },

    fly: function (location) {
      if (!location || (this.location && location.latitude
          && this.location.latitude === location.latitude
          && location.longitude
          && this.location.longitude === location.longitude)) return;
      if (!this.vis) {
        this.pendingLocation = location;
        return;
      }

      function _fly() {
        this.vis.mapView.map_leaflet.setView(
            new L.LatLng(location.latitude, location.longitude), 7,
            {animate: true});
        this.location = location;
      }

      // Use hard coords if available.
      if (location.latitude && location.longitude) return _fly.call(this);

      // Attempt to geocode an address string, if available.
      if (location.name)
        this.geocoder.geocode({address: location.name},
            _.bind(function (res, stat) {
          if (stat === google.maps.GeocoderStatus.OK) {
            location.latitude = res[0].geometry.location.lat();
            location.longitude = res[0].geometry.location.lng();
            _fly.call(this);
          }
        }, this));
    },

    getMarkers: function (remove) {
      var map = this.vis.mapView.map_leaflet;
      var limit = remove ? 50: 25;
      var zoom = map.getZoom();
      var bounds = map.getBounds();
      var buffer = (bounds.getNorthEast().lat - bounds.getSouthWest().lat)/5;
      var frame = "ST_Envelope(ST_MakeLine(CDB_LatLng("
          + (bounds.getNorthWest().lat + buffer) + ","
          + (bounds.getNorthWest().lng - buffer) + "),CDB_LatLng("
          + (bounds.getSouthEast().lat - buffer) + ","
          + (bounds.getSouthEast().lng + buffer) + ")))";

      // Do SQL query.
      var self = this;
      this.sql.execute("WITH rg AS (SELECT cartodb_id, floor(st_x(the_geom_webmercator)/({{geobucket}}"
          + " * CDB_XYZ_Resolution({{z}}))) mx, floor(st_y(the_geom_webmercator)/({{geobucket}}"
          + " * CDB_XYZ_Resolution({{z}}))) my, st_x(the_geom) x, st_y(the_geom) y, turi, uri, name, username, handle, caption "
          + "FROM {{table_name}} WHERE {{frame}} && the_geom ORDER BY created_at DESC LIMIT {{limit}}) "
          + "SELECT DISTINCT ON (mx,my) cartodb_id, x, y, turi, uri, name, username, handle, caption FROM rg", {
        table_name: 'instagrams',
        frame: frame,
        z: zoom,
        geobucket: 120,
        limit: limit
      }).done(_.bind(function (data) {
        if (remove) this.removeMarkers();
        _.each(data.rows, _.bind(function (r) {
          if (!this.markers[r.cartodb_id]) {
            var img = '<img src="'+ r.turi + '" width="36" height="36" />';
            var marker = L.marker([r.y, r.x], _.extend({
              icon: L.divIcon({
                html: img,
                iconSize: [36, 36],
                iconAnchor: [18, 46],
              })
            }, r)).addTo(map).on('click', function (e) {

              // Convert marker to fancybox object.
              function box(m) {
                return {
                  href: m.options.uri,
                  title: '"' + m.options.caption + '" - '
                      + '<a href="/' + m.options.username + '" class="navigate">'
                      + m.options.name + '</a>'
                      + ' (@' + m.options.handle + ')'
                };
              }

              // Build current list of images.
              var imgs = [box(this)];
              _.each(self.markers, function (m) {
                if (m.options.uri !== imgs[0].href)
                  imgs.push(box(m));
              });

              // Show list in modal.
              $.fancybox(imgs, {
                openEffect: 'fade',
                closeEffect: 'fade',
                closeBtn: false,
                nextClick: true,
                padding: 0,
                afterShow: function () {
                  $('.fancybox-title a.navigate').click(_.bind(self.navigate, self));
                }
              });
            });
            this.markers[r.cartodb_id] = marker;
          }
        }, this));
      }, this));
    },

    removeMarkers: function () {
      _.each(this.markers, _.bind(function (v, k) {
        this.vis.mapView.map_leaflet.removeLayer(v);
        delete this.markers[k]
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
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to href.
      this.app.router.navigate($(e.target).attr('href'),
          {trigger: true});

      // Close the modal.
      $.fancybox.close();
    }

  });
});
