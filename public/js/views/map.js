/*
 * Map view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/popup.html'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, popup) {
  return Backbone.View.extend({

    el: '#map',
    mapped: false,
    instaMarkers: {},
    mediaMarkers: {},
    plotting: false,
    saving: false,
    fliedTo: false,

    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Client-wide subscriptions.
      this.subscriptions = [];

      // Socket subscriptions.
      // this.app.rpc.socket.on('instagram.new', _.bind(this.getInstaMarkers, this, false));
      // this.app.rpc.socket.on('media.new', _.bind(this.getMediaMarkers, this, false));
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
          _.bind(this.flyTo, this)));

      // Listen for marker refresh.
      this.subscriptions.push(mps.subscribe('map/refresh',
          _.bind(this.getMediaMarkers, this, true)));

      // Get a geocoder.
      if (!this.geocoder)
        this.geocoder = new google.maps.Geocoder();

      // Init the load indicator.
      if (!this.spin)
        this.spin = new Spin(this.$('.map-spin'), {
          color: '#b3b3b3',
          lines: 17,
          length: 12,
          width: 3,
          radius: 18
        });
      if (!this.plotSpin)
        this.plotSpin = new Spin(this.$('.plot-spin'));
      this.plotSpin.start();

      // Create the map.
      if (!this.mapped) {
        if (!this.$el.hasClass('closed'))
          this.spin.start();
        this.map();
      }

      // Trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Save refs.
      this.plotButton = this.$('.plot-button');
      this.plotForm = this.$('.plot-form');

      // Changes to map display are animated.
      this.$el.addClass('animated');

      // Save DOM refs.
      this.mapInner = this.$('.map-inner');
      this.hider = this.$('.hide-show');
      this.lesser = this.$('.less-more');

      this.delegateEvents();

      // Show carto buttons / loader.
      _.delay(_.bind(function () {
        // this.$('.cartodb-zoom, .cartodb-tiles-loader')
        this.$('.cartodb-zoom')
            .css({visibility: 'visible'});
      }, this), 1000);

      // Do the first update.
      // this.update();
    },

    update: function () {

      // Hide/show plot button.
      if (this.app.profile && this.app.profile.member
          && this.app.profile.member.role !== 1
          && this.app.profile.content.page
          && this.app.profile.content.page.author)
        this.plotButton.css({visibility: 'visible'})
      else this.plotButton.css({visibility: 'hidden'});

      // Reset.
      if (this.plotting) this.listenForPlot();
    },

    // Bind mouse events.
    events: {
      'click .hide-show': 'hideShow',
      'click .less-more': 'lessMore',
      'click .plot-button': 'listenForPlot',
      'click .plot-cancel': 'listenForPlot',
      'click .plot-map': 'plotObject',
    },

    map: function () {
      this.mapped = true;

      var opts = {
        zoom: 3,
        center_lat: 40,
        center_lon: -20,
        scrollwheel: false,
        https: true
      };

      // Setup the map.
      this.sql = new cartodb.SQL({user: 'island'});
      cartodb.createVis('map_inner',
          'https://island.cartodb.com/api/v1/viz/crags/viz.json', opts,
          _.bind(function (vis, layers) {
        this.vis = vis;
        this.vis.mapView.map_leaflet.options.maxZoom = 17;
        this.vis.mapView.map_leaflet.options.minZoom = 3;
        this.layers = layers;
        this.spin.stop();

        // Handle infowindows.
        this.layers[1].infowindow.set('template', _.template(popup).call(this));
        this.layers[1].on('featureClick', _.bind(function (e, pos, latlng, data) {
          _.delay(_.bind(function () {
            $('a.popup-link').click(_.bind(function (e) {
              e.preventDefault();

              // Route to crag.
              this.app.router.navigate($(e.target).closest('a').attr('href'),
                  {trigger: true});
            }, this));
          }, this), 500);
        }, this));

        // Init events for markers.
        this.vis.mapView.map_leaflet.on('zoomend', 
            _.bind(this.getInstaMarkers, this, true));
        this.vis.mapView.map_leaflet.on('moveend', 
            _.bind(this.getInstaMarkers, this, false));
        this.vis.mapView.map_leaflet.on('zoomend', 
            _.bind(this.getMediaMarkers, this, true));
        this.vis.mapView.map_leaflet.on('moveend', 
            _.bind(this.getMediaMarkers, this, false));
        this.vis.mapView.map_leaflet.on('click', _.bind(function (e) {
          this.setPlotLocation({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          });
        }, this));

        // Hide the zoomer and plot button if the map is hidden.
        this.zoom = this.$('.cartodb-zoom');
        if (!store.get('mapClosed')) {
          this.zoom.show();
          this.plotButton.show();
        } else this.zoom.hide();

        // Get the markers.
        this.getInstaMarkers(true);
        this.getMediaMarkers(true);

        // Fly to a location if there is one pending.
        if (this.pendingLocation) this.flyTo(this.pendingLocation);

      }, this));
    },

    flyTo: function (location) {
      if (!location || (this.location && location.latitude
          && this.location.latitude === location.latitude
          && location.longitude
          && this.location.longitude === location.longitude)) return;
      this.fliedTo = true;
      if (!this.vis) {
        this.pendingLocation = location;
        return;
      }

      function _fly() {
        this.vis.mapView.map_leaflet.setView(
            new L.LatLng(location.latitude, location.longitude), 10);
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

    getInstaMarkers: function (remove) {
      return;
      var map = this.vis.mapView.map_leaflet;
      var limit = remove ? 200: 100;
      var zoom = map.getZoom();
      var bounds = map.getBounds();
      var buffer = (bounds.getNorthEast().lat - bounds.getSouthWest().lat) / 5;
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
        table_name: window.__s ? 'instagrams': 'instagrams_dev',
        frame: frame,
        z: zoom,
        geobucket: 1,
        limit: limit
      }).done(_.bind(function (data) {
        if (remove) this.removeInstaMarkers();
        _.each(data.rows, _.bind(function (r) {
          if (!this.instaMarkers[r.cartodb_id]) {
            r.uri = util.https(r.uri);
            r.turi = util.https(r.turi);
            var img = '<img src="' + r.turi + '" width="36" height="36" />';
            var marker = L.marker([r.y, r.x], _.extend({
              icon: L.divIcon({
                html: img,
                iconSize: [36, 36],
                iconAnchor: [18, 46],
              })
            }, r)).addTo(map).on('click', function (e) {

              // Blur map.
              map.fire('blur');

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

                  // Init links in title.
                  $('.fancybox-title a.navigate').click(_.bind(self.navigate, self));
                },
                afterClose: function () {
                  
                  // Blur map.
                  map.fire('focus');
                }
              });
            });
            this.instaMarkers[r.cartodb_id] = marker;
          }
        }, this));
      }, this));
    },

    getMediaMarkers: function (remove) {
      return;
      var self = this;
      var map = this.vis.mapView.map_leaflet;
      var limit = remove ? 200: 100;
      var zoom = map.getZoom();
      var bounds = map.getBounds();
      var buffer = (bounds.getNorthEast().lat - bounds.getSouthWest().lat) / 5;
      var frame = "ST_Envelope(ST_MakeLine(CDB_LatLng("
          + (bounds.getNorthWest().lat + buffer) + ","
          + (bounds.getNorthWest().lng - buffer) + "),CDB_LatLng("
          + (bounds.getSouthEast().lat - buffer) + ","
          + (bounds.getSouthEast().lng + buffer) + ")))";

      // Do SQL query.
      var self = this;
      this.sql.execute("WITH rg AS (SELECT cartodb_id, floor(st_x(the_geom_webmercator)/({{geobucket}}"
          + " * CDB_XYZ_Resolution({{z}}))) mx, floor(st_y(the_geom_webmercator)/({{geobucket}}"
          + " * CDB_XYZ_Resolution({{z}}))) my, st_x(the_geom) x, st_y(the_geom) y, mid, pkey, turi "
          + "FROM {{table_name}} WHERE {{frame}} && the_geom ORDER BY created_at DESC LIMIT {{limit}}) "
          + "SELECT DISTINCT ON (mx,my) cartodb_id, x, y, mid, pkey, turi FROM rg", {
        table_name: window.__s ? 'medias': 'medias_dev',
        frame: frame,
        z: zoom,
        geobucket: 1,
        limit: limit
      }).done(_.bind(function (data) {
        if (remove) this.removeMediaMarkers();
        _.each(data.rows, _.bind(function (r) {
          if (!this.mediaMarkers[r.cartodb_id]) {
            r.turi = util.https(r.turi);
            var img = '<img src="' + r.turi + '" width="36" height="36" />';
            var marker = L.marker([r.y, r.x], _.extend({
              icon: L.divIcon({
                html: img,
                iconSize: [36, 36],
                iconAnchor: [18, 46],
              })
            }, r)).addTo(map).on('click', function (e) {

              // Route to post if it exists.
              self.app.router.navigate(this.options.pkey, {trigger: true});

            });
            this.mediaMarkers[r.cartodb_id] = marker;
          }
        }, this));
      }, this));
    },

    removeInstaMarkers: function () {
      _.each(this.instaMarkers, _.bind(function (v, k) {
        this.vis.mapView.map_leaflet.removeLayer(v);
        delete this.instaMarkers[k]
      }, this));
    },

    removeMediaMarkers: function () {
      _.each(this.mediaMarkers, _.bind(function (v, k) {
        this.vis.mapView.map_leaflet.removeLayer(v);
        delete this.mediaMarkers[k]
      }, this));
    },

    hideShow: function (e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.hider.text('Hide map');
        this.hider.addClass('split-left');
        this.lesser.show();
        this.zoom.show();
        this.plotButton.show();
        this.resize(250);
        store.set('mapClosed', false);
      } else {
        this.$el.addClass('closed');
        this.hider.text('Show map');
        this.hider.removeClass('split-left');
        this.plotButton.hide();
        this.lesser.hide();
        this.zoom.hide();
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

    listenForPlot: function (e) {
      if (e) e.preventDefault(e);
      if (this.plotting) {
        this.plotting = false;
        this.plotButton.removeClass('active');
        this.plotButton.show();
        this.plotForm.hide();
        this.$el.removeClass('plotting');
        this.layers[1].setInteraction(true);
        this.$('.cartodb-infowindow').css({opacity: 1});
      } else if (this.vis) {
        this.plotting = true;
        this.vis.mapView.map_leaflet.fire('focus');
        this.plotButton.addClass('active');
        this.plotButton.hide();
        if (this.app.profile.content
            && this.app.profile.content.page
            && this.app.profile.content.page.location)
          this.setPlotLocation(this.app.profile.content.page.location);
        else
          this.setPlotLocation();
        this.plotForm.show();
        this.$el.addClass('plotting');
        this.layers[1].setInteraction(false);
        this.$('.cartodb-infowindow').css({opacity: 0});
      }
    },

    getPlotType: function () {
      if (!this.app.profile.content 
          || !this.app.profile.content.page) return false;
      var page = this.app.profile.content.page;
      var type;
      if (page.medias)
        type = 'post';
      else if (page.bcnt)
        type = 'crag';
      else if (page.crag_id)
        type = 'ascent';
      return type;
    },

    getPlotLocation: function () {
      var location = {
        latitude: parseFloat($('input[name="latitude"]', this.plotForm).val()),
        longitude: parseFloat($('input[name="longitude"]', this.plotForm).val())
      };
      if (!_.isNumber(location.latitude) || _.isNaN(location.latitude)
          || !_.isNumber(location.longitude) || _.isNaN(location.longitude))
        return false;
      else return location;
    },

    setPlotLocation: function (location) {
      var latEl = $('input[name="latitude"]', this.plotForm);
      var lonEl = $('input[name="longitude"]', this.plotForm);
      latEl.val(location ? location.latitude: '');
      lonEl.val(location ? location.longitude: '');
      _.delay(function () { latEl.focus(); }, 0);
    },

    plotObject: function (e) {
      if (!this.plotting || this.saving) return false;
      this.saving = true;

      // Grab new location.
      var payload = {location: this.getPlotLocation()};
      if (!payload.location) {
        mps.publish('flash/new', [{
          message: 'Invalid coordinates',
          level: 'error'
        }, false]);
        this.saving = false;
        return false;
      }

      // Determine type.
      var type = this.getPlotType();
      if (!type) {
        finish.call(this);
        return false;
      }

      // Update info bar.
      this.plotForm.hide();
      $('span', this.plotButton).hide();
      this.plotButton.show();
      this.plotSpin.target.show();
      this.plotSpin.start();

      // Determine path.
      var path = '/api/' + type + 's/';
      var page = this.app.profile.content.page;
      switch (type) {
        case 'post': path += page.key; break;
        case 'crag': path += 'crags/' + page.key; break;
        case 'ascent': path += 'crags/' + page.key; break;
      }

      // Now do the save.
      rest.put(path, payload, _.bind(function (err, data) {

        // Toggle plot button state.
        finish.call(this);

        if (err) {

          // Publish error.
          mps.publish('flash/new', [{
            message: err.message,
            level: 'error'
          }, false]);

          return;
        }

        // Refresh markers.
        this.getMediaMarkers(true);

        // Update page location.
        this.app.profile.content.page.location = payload.location;

      }, this));

      function finish() {
        this.listenForPlot();
        $('span', this.plotButton).show();
        this.plotSpin.target.hide();
        this.plotSpin.stop();
        this.saving = false;
      }

      return false;
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
      this.app.router.navigate($(e.target).attr('href'), {trigger: true});

      // Close the modal.
      $.fancybox.close();
    }

  });
});
