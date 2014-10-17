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
  'text!../../templates/popup.html',
  'text!../../templates/carto/crags.css'
], function ($, _, Backbone, Modernizr, mps, rest, util, Spin, popup, css) {
  return Backbone.View.extend({

    el: '#map',
    mapped: false,
    plotting: false,
    saving: false,
    fliedTo: false,
    api_key: '883965c96f62fd219721f59f2e7c20f08db0123b',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];

      this.table = window.__s ? 'crags': 'crags_dev';
      this.pre = "select *, st_asgeojson(the_geom) as geometry from " + this.table
          + " where forbidden is NULL";
    },

    render: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      this.cssTemplate = _.template(css);

      // Listen for fly to requests.
      this.subscriptions.push(mps.subscribe('map/fly',
          _.bind(this.flyTo, this)));

      // Listen for marker refresh.
      // this.subscriptions.push(mps.subscribe('map/refresh',
      //     _.bind(this.getMediaMarkers, this, true)));

      // Get a geocoder.
      if (!this.geocoder) {
        this.geocoder = new google.maps.Geocoder();
      }

      // Init the load indicator.
      if (!this.spin) {
        this.spin = new Spin(this.$('.map-spin'), {
          color: '#b3b3b3',
          lines: 17,
          length: 12,
          width: 3,
          radius: 18
        });
      }
      if (!this.plotSpin) {
        this.plotSpin = new Spin(this.$('.plot-spin'));
      }
      this.plotSpin.start();

      // Create the map.
      if (!this.mapped) {
        if (!this.$el.hasClass('closed')) {
          this.spin.start();
        }
        this.map();
      }

      this.setup();
      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Save refs.
      this.plotButton = this.$('.plot-button');
      this.plotForm = this.$('.plot-form');
      this.submitButton = this.$('.new-session-button');

      // Changes to map display are animated.
      this.$el.addClass('animated');

      // Save DOM refs.
      this.mapInner = this.$('.map-inner');
      this.hider = this.$('.hide-show');
      this.lesser = this.$('.less-more');

      // Hide/show plot button.
      if (this.app.profile && this.app.profile.member) {
        this.plotButton.css({visibility: 'visible'})
      } else {
        this.plotButton.css({visibility: 'hidden'});
      }

      // Handle warning, and error displays.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('required') && el.val().trim() === '') {
          el.addClass('input-warning');
        }
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Handle warnings on focus.
      this.$('input[type="text"]').focus(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-warning')) {
          el.removeClass('input-warning');
        }
      });

      this.$('input[type="text"]').keyup(_.bind(this.validateCrag, this));

      this.delegateEvents();
    },

    // Bind mouse events.
    events: {
      'click .hide-show': 'hideShow',
      'click .less-more': 'lessMore',
      'click .plot-button': 'listenForPlot',
      'click .plot-cancel': 'listenForPlot',
      'click .new-session-button': 'addCrag',
    },

    map: function () {

      // Setup the base map.
      this.sql = new cartodb.SQL({user: 'island', api_key: this.api_key,
          protocol: 'https'});
      this.map = new L.Map('map_inner', {
        center: [40, -20],
        zoom: 3,
        minZoom: 2
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
          map_key: this.api_key
        },
        sublayers: [{
          sql: this.pre,
          cartocss: this.cssTemplate.call(this),
          interactivity: 'cartodb_id,geometry,id,key,name'
        }]
      }, {https: true})
      .addTo(this.map)
      .done(_.bind(function (layer) {
        this.dataLayer = layer.getSubLayer(0);

        this.dataLayer.bind('featureOver', _.bind(this.featureOver, this));
        this.dataLayer.bind('featureOut', _.bind(this.featureOut, this));
        this.dataLayer.bind('featureClick', _.bind(this.featureClick, this));
        this.dataLayer.setInteraction(true);

        this.map.on('click', _.bind(function (e) {
          this.setPlotLocation({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          });
        }, this));

        this.mapped = true;
        this.spin.stop();

        // Check pending.
        if (this.pendingLocation) {
          this.flyTo(this.pendingLocation);
        }
      }, this));
    },

    featureOver: function (e, pos, latlng, data) {
      $(this.map.getContainer()).css('cursor', 'pointer');
      if (this.point) {
        if (data.cartodb_id === this.point.cartodb_id) {
          return;
        }
        this.map.removeLayer(this.point);
        this.point.cartodb_id = data.cartodb_id;
      }
      // this.point = new L.GeoJSON(JSON.parse(data.geometry), {
      //   pointToLayer: function (feature, latlng) {
      //     return new L.CircleMarker(latlng, {
      //       color: '#666',
      //       weight: 1.5,
      //       fillColor: '#4bb8d7',
      //       fillOpacity: 0.3,
      //       clickable: false
      //     }).setRadius(12);
      //   }
      // }).addTo(this.map);
    },

    featureOut: function() {
      $(this.map.getContainer()).css('cursor', 'auto');
      if (this.point) {
        this.map.removeLayer(this.point);
        this.point.cartodb_id = null;
      }
    },

    featureClick: function (e, pos, latlng, data) {
      this.app.router.navigate('crags/' + data.key, {trigger: true});
    },

    flyTo: function (location) {
      if (!location || (this.location && location.latitude
          && this.location.latitude === location.latitude
          && location.longitude
          && this.location.longitude === location.longitude)) {
        return;
      }
      this.fliedTo = true;
      if (!this.map) {
        this.pendingLocation = location;
        return;
      }

      function _fly() {
        this.map.setView(new L.LatLng(location.latitude,
            location.longitude), 10);
        this.location = location;
      }

      // Use hard coords if available.
      if (location.latitude && location.longitude) {
        return _fly.call(this);
      }

      // Attempt to geocode an address string, if available.
      if (location.name) {
        this.geocoder.geocode({address: location.name},
            _.bind(function (res, stat) {
          if (stat === google.maps.GeocoderStatus.OK) {
            location.latitude = res[0].geometry.location.lat();
            location.longitude = res[0].geometry.location.lng();
            _fly.call(this);
          }
        }, this));
      }
    },

    hideShow: function (e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.hider.text('Hide map');
        this.hider.addClass('split-left');
        this.lesser.show();
        this.plotButton.show();
        this.resize(250);
        store.set('mapClosed', false);
      } else {
        this.$el.addClass('closed');
        this.hider.text('Show map');
        this.hider.removeClass('split-left');
        this.plotButton.hide();
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
        store.set('mapTall', false);
      } else {
        this.$el.addClass('opened');
        this.lesser.text('Less map');
        this.lesser.removeClass('split-right');
        this.hider.hide();
        this.resize(600);
        store.set('mapTall', true);
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
        this.dataLayer.setInteraction(true);
        this.$('.cartodb-infowindow').css({opacity: 1});
        this.$('input[type="text"]').val('');
      } else if (this.map) {
        this.plotting = true;
        this.map.fire('focus');
        this.plotButton.addClass('active');
        this.plotButton.hide();
        this.setPlotLocation();
        this.plotForm.show();
        this.$el.addClass('plotting');
        this.dataLayer.setInteraction(false);
        this.$('.cartodb-infowindow').css({opacity: 0});
      }
    },

    getNewCragPayload: function () {
      var name = $('input[name="name"]', this.plotForm).val().trim();
      var latitude = parseFloat($('input[name="latitude"]', this.plotForm).val());
      var longitude = parseFloat($('input[name="longitude"]', this.plotForm).val());
      if (name === '') {
        return false;
      } else if (!_.isNumber(latitude) || _.isNaN(latitude)
          || !_.isNumber(longitude) || _.isNaN(longitude)) {
        return false;
      } else {
        return {
          name: name,
          latitude: latitude,
          longitude: longitude
        };
      }
    },

    setPlotLocation: function (location) {
      var nameEl = $('input[name="name"]', this.plotForm);
      var latEl = $('input[name="latitude"]', this.plotForm);
      var lonEl = $('input[name="longitude"]', this.plotForm);
      if (location && location.latitude) {
        latEl.val(location.latitude).removeClass('input-warning');
      }
      if (location && location.longitude) {
        lonEl.val(location.longitude).removeClass('input-warning');
      }
      _.delay(function () { nameEl.focus(); }, 0);
    },

    validateCrag: function () {
      if (!this.getNewCragPayload()) {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
    },

    addCrag: function (e) {
      if (!this.plotting || this.saving) {
        return false;
      }
      var payload = this.getNewCragPayload();
      if (!payload) {
        return false;
      }
      this.saving = true;

      // Update info bar.
      this.plotForm.hide();
      $('span', this.plotButton).hide();
      this.plotButton.show();
      this.plotSpin.target.show();
      this.plotSpin.start();
      return false;

      // Now do the save.
      rest.post('/api/crags', payload, _.bind(function (err, data) {

        // Toggle plot button state.
        finish.call(this);

        if (err) {

          // Publish error.
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }, true]);
          return;
        }
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
      if (!this.map) {
        return;
      }
      var sizer = setInterval(_.bind(function () {
        this.map.invalidateSize();
        if (this.$el.height() + 1 >= height) {
          clearInterval(sizer);
        }
      }, this), 20);
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
      $.fancybox.close();
    },

  });
});
