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

    initialize: function (app) {
      this.app = app;
      this.mapped = false;
      this.plotting = false;
      this.saving = false;
      this.fliedTo = false;
      this.subscriptions = [];
    },

    render: function () {

      this.$el.show();

      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      this.cssTemplate = _.template(css);

      // Map spinner.
      this.subscriptions.push(mps.subscribe('map/start',
          _.bind(function() { this.spin.start(); }, this)));
      this.subscriptions.push(mps.subscribe('map/stop',
          _.bind(function() { this.spin.stop(); }, this)));

      // Listen for fly to requests.
      this.subscriptions.push(mps.subscribe('map/fly',
          _.bind(this.flyTo, this)));
      this.subscriptions.push(mps.subscribe('map/fit',
          _.bind(this.fitWorld, this)));

      // Listen for crags layer refresh.
      this.subscriptions.push(mps.subscribe('map/refresh/crags',
          _.bind(function () {
        if (this.map) {
          this.map.removeLayer(this.cragsLayer);
          this.addCragsLayer();
        }
      }, this)));

      // Crag was added.
      this.subscriptions.push(mps.subscribe('map/add',
          _.bind(function (opts) {
        opts = opts || {};
        if (this.$el.hasClass('closed')) {
          this.hideShow();
        }
        this.pendingSectorParentId = opts.parent_id;
        this.listenForPlot(null, null, !!opts.parent_id);
      }, this)));

      // Request to listen for plot.
      this.plotQueue = [];
      this.subscriptions.push(mps.subscribe('map/listen',
          _.bind(function () {
        if (this.dataLayer) {
          this.listenForPlot(null, true);
        } else {
          this.plotQueue.push(_.bind(this.listenForPlot, this, null, true));
        }
      }, this)));

      // Get a geocoder.
      if (!this.geocoder) {
        this.geocoder = new google.maps.Geocoder();
      }

      // Init the load indicator.
      if (!this.spin) {
        this.spin = new Spin(this.$('.map-spin'), {
          color: '#404040',
          lines: 17,
          length: 12,
          width: 3,
          radius: 18
        });
      }
      if (!this.plotSpin) {
        this.plotSpin = new Spin(this.$('.plot-spin'), {
          color: '#404040',
          lines: 13,
          length: 3,
          width: 2,
          radius: 6,
        });
      }

      // Create the map.
      if (!this.mapped) {
        this.createMap();
        this.addCragsLayer();
      }

      this.setup();
      return this;
    },

    setup: function () {

      this.plotButton = this.$('.map-plot');
      // this.weatherButton = this.$('.map-weather');
      this.plotForm = this.$('.plot-form');
      this.updateNote = this.$('.update-note');
      this.submitButton = this.$('.new-session-button');
      this.infoBox = this.$('.map-infobox');
      this.helpText = this.$('.map-control .help');
      this.mapInner = this.$('.map-inner');
      this.hider = this.$('.hide-show');
      this.lesser = this.$('.less-more');

      // Changes to map display are animated.
      this.$el.addClass('animated');

      // Hide/show plot button.
      if (this.app.profile && this.app.profile.member) {
        this.plotButton.css({visibility: 'visible'});
      } else {
        this.plotButton.css({visibility: 'hidden'});
      }
      if (!this.$el.hasClass('closed')) {
        this.plotButton.show();
        // this.weatherButton.show();
      }

      // this.weatherButton.css({visibility: 'visible'})

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
      'click .map-plot': 'listenForPlot',
      // 'click .map-weather': 'weather',
      'click .plot-cancel': 'listenForPlot',
      'click .new-session-button': 'addCrag',
    },

    createMap: function () {
      if (!this.$el.hasClass('closed')) {
        this.spin.start();
      }

      // Setup the base map.
      this.sql = new cartodb.SQL({user: 'island', protocol: 'https'});
      this.map = new L.Map('map_inner', {
        center: [40, -20],
        zoom: 3,
        minZoom: 2,
        maxZoom: 19,
        scrollWheelZoom: false
      });

      $(document).bind('keydown', _.bind(function (e) {
        if (e.keyCode === 16) {
          this.map.scrollWheelZoom.enable();
        }
      }, this));
      $(document).bind('keyup', _.bind(function (e) {
        if (e.keyCode === 16) {
          this.map.scrollWheelZoom.disable();
        }
      }, this));

      // Add a base tile layer.
      L.mapbox.accessToken = this.app.mapbox.accessToken;
      L.tileLayer('https://api.mapbox.com/v4/mapbox.streets-satellite/{z}/{x}/{y}.png?access_token=' + L.mapbox.accessToken, {
        attribution: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(this.map);

      // this.temperature = L.tileLayer('http://{s}.tile.openweathermap.org/map/temp/{z}/{x}/{y}.png', {
      //     attribution: 'Map data © OpenWeatherMap',
      //     maxZoom: 18
      // }).setOpacity(.25);

      // this.precipitation = L.tileLayer('http://{s}.tile.openweathermap.org/map/rain/{z}/{x}/{y}.png', {
      //     attribution: 'Map data © OpenWeatherMap',
      //     maxZoom: 18
      // }).setOpacity(.5);

      // this.weatherLayers = L.layerGroup().addTo(this.map);

      // Handle plot.
      this.map.on('click', _.bind(function (e) {
        var location = {
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        };
        this.setPlotLocation(location);
        mps.publish('map/plot', [location]);
      }, this));
      this.map.on('mouseout', _.bind(this.featureOut, this));

      // Check pending.
      if (this.pendingLocation) {
        this.flyTo(this.pendingLocation);
      }

      this.spin.stop();
    },

    addCragsLayer: function () {
      if (!this.$el.hasClass('closed')) {
        this.spin.start();
      }

      // Break the very sticky cache with random sql clause.
      var sql = this.app.cartodb.sqlPre + " and id != '" + util.makeID() + "'";
      
      // Create the data layer.
      cartodb.createLayer(this.map, {
        user_name: 'island',
        type: 'cartodb',
        cartodb_logo: false,
        extra_params: {
          // map_key: #
        },
        sublayers: [{
          sql: sql,
          cartocss: this.cssTemplate.call(this),
          interactivity: 'cartodb_id,geometry,id,key,name,bcnt,rcnt'
        }]
      }, {https: true})
      .addTo(this.map)
      .done(_.bind(function (layer) {
        this.cragsLayer = layer;
        this.dataLayer = layer.getSubLayer(0);

        this.dataLayer.bind('featureOver', _.bind(this.featureOver, this));
        this.dataLayer.bind('featureOut', _.bind(this.featureOut, this));
        this.dataLayer.bind('featureClick', _.bind(this.featureClick, this));
        this.dataLayer.setInteraction(true);

        this.mapped = true;
        this.spin.stop();

        _.each(this.plotQueue, function (fn) { fn(); });
        this.plotQueue = [];

        _.defer(function () {
          window.dispatchEvent(new Event('resize'));
        });
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
      var geom = JSON.parse(data.geometry);
      this.point = new L.GeoJSON(geom, {
        pointToLayer: _.bind(function (feature, latlng) {
          var c = new L.CircleMarker(latlng, {
            color: 'rgba(0,0,0,0.9)',
            weight: 1,
            fillOpacity: 0,
            clickable: false
          }).setRadius(this.getCragRadius(data));
          _.defer(_.bind(function () {
            $('.map-infobox-title', this.infoBox).text(data.name);
            $('.map-infobox-subtitle', this.infoBox).text(
                util.addCommas(data.bcnt) + ' problems | ' +
                util.addCommas(data.rcnt) + ' routes');
            var p = this.map.layerPointToContainerPoint(c._point);
            this.infoBox.css({left: p.x + 9 + this.getCragRadius(data),
                top: p.y - 28}).show();
          }, this));
          return c;
        }, this)
      }).addTo(this.map);
    },

    featureOut: function() {
      $(this.map.getContainer()).css('cursor', 'auto');
      if (this.point) {
        this.map.removeLayer(this.point);
        this.point.cartodb_id = null;
        this.infoBox.hide();
      }
    },

    featureClick: function (e, pos, latlng, data) {
      this.app.router.navigate('crags/' + data.key, {trigger: true});
    },

    getCragRadius: function (info) {
      var cnt = Math.max(info.bcnt, info.rcnt);
      var d = 10;
      if (cnt < 50) {
        d = 25;
      }
      if (cnt >= 50) {
        d = 50;
      }
      if (cnt >= 200) {
        d = 75;
      }
      if (cnt >= 500) {
        d = 100;
      }
      if (cnt >= 1000) {
        d = 150;
      }
      if (cnt >= 2000) {
        d = 200;
      }
      return d / 2;
    },

    flyTo: function (location) {
      if (!location || (this.location && location.latitude &&
          this.location.latitude === location.latitude &&
          location.longitude &&
          this.location.longitude === location.longitude)) {
        return;
      }
      this.fliedTo = true;
      if (!this.map) {
        this.pendingLocation = location;
        return;
      }

      function _fly() {
        this.map.setView(new L.LatLng(location.latitude,
            location.longitude), 16);
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

    fitWorld: function () {
      this.map.setView(new L.LatLng(40, -20), 3);
    },

    hideShow: function (e) {
      if (this.$el.hasClass('closed')) {
        this.$el.removeClass('closed');
        this.hider.text('Hide map');
        this.hider.addClass('split-left');
        this.lesser.show();
        this.plotButton.show();
        this.helpText.show();
        if (this.$el.hasClass('plotting-external')) {
          this.updateNote.show();
        }
        this.resize(250);
        store.set('mapClosed', false);
      } else {
        if (this.plotting) {
          this.listenForPlot();
        }
        this.$el.addClass('closed');
        this.hider.text('Show map');
        this.hider.removeClass('split-left');
        this.plotButton.hide();
        this.helpText.hide();
        this.updateNote.hide();
        this.lesser.hide();
        store.set('mapClosed', true);
      }
      this.featureOut();
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
      this.featureOut();
    },

    listenForPlot: function (e, external, sector) {
      if (e) {
        e.preventDefault(e);
      }
      if (this.plotting) {
        this.plotting = false;
        if (!external) {
          this.plotButton.removeClass('active');
          this.plotButton.show();
          this.plotForm.hide();
        }
        this.$el.removeClass('plotting');
        if (external) {
          this.updateNote.hide();
          this.$el.removeClass('plotting-external');
        }
        this.dataLayer.setInteraction(true);
        this.$('.cartodb-infowindow').css({opacity: 1});
        this.$('input[type="text"]').val('');
      } else if (this.dataLayer) {
        this.plotting = true;
        if (!external) {
          this.map.fire('focus');
          this.plotButton.addClass('active');
          this.plotButton.hide();
          if (sector) {
            $('input[name="name"]', this.plotForm).attr('placeholder',
                'New sector name');
          }
          else {
            $('input[name="name"]', this.plotForm).attr('placeholder',
                'New crag name');
          }
          this.plotForm.show();
          this.setPlotLocation();
        }
        this.$el.addClass('plotting');
        if (external) {
          if (!this.$el.hasClass('closed')) {
            this.updateNote.show();
          }
          this.$el.addClass('plotting-external');
        }
        this.dataLayer.setInteraction(false);
        this.$('.cartodb-infowindow').css({opacity: 0});
        this.featureOut();
      }
    },

    getNewCragPayload: function () {
      var name = $('input[name="name"]', this.plotForm).val().trim();
      var latitude = parseFloat($('input[name="latitude"]', this.plotForm).val());
      var longitude = parseFloat($('input[name="longitude"]', this.plotForm).val());
      if (name === '') {
        return false;
      } else if (!_.isNumber(latitude) || _.isNaN(latitude) ||
          !_.isNumber(longitude) || _.isNaN(longitude)) {
        return false;
      } else {
        return {
          name: util.sanitize(name),
          parent_id: this.pendingSectorParentId,
          location: {
            latitude: latitude,
            longitude: longitude
          }
        };
      }
    },

    setPlotLocation: function (location) {
      if (!this.plotForm.is(':visible')) {
        return;
      }
      var nameEl = $('input[name="name"]', this.plotForm);
      var latEl = $('input[name="latitude"]', this.plotForm);
      var lonEl = $('input[name="longitude"]', this.plotForm);
      if (location && location.latitude) {
        latEl.val(location.latitude).removeClass('input-warning');
      }
      if (location && location.longitude) {
        lonEl.val(location.longitude).removeClass('input-warning');
      }
      this.validateCrag();
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

      // Now do the save.
      rest.post('/api/crags', payload, _.bind(function (err, data) {
        this.plotSpin.target.hide();
        this.plotSpin.stop();
        this.saving = false;

        if (err) {
          var flash = err.message && err.message === 'no country code found' ?
              {message: 'Hmm, are you sure there\'s a crag there?'}:
              {err: err};
          flash.level = 'error';
          mps.publish('flash/new', [flash, true]);
        } else {
          var target;
          if (data.parent) {
            target = 'sector in ' + data.parent;
          } else {
            target = 'crag in ' + data.country;
          }
          mps.publish('flash/new', [{
            message: 'You added a new ' + target + '.',
            level: 'alert'
          }, true]);

          // Go to new crag page.
          this.app.router.navigate('crags/' + data.key + '/config',
              {trigger: true});

          if (store.get('pendingAscent')) {
            mps.publish('ascent/add', [{crag_id: data._id}]);
          }
        }

        // Close form.
        this.listenForPlot();
        $('span', this.plotButton).show();
        this.submitButton.attr('disabled', true).addClass('disabled');
        mps.publish('map/refresh/crags');
      }, this));

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

    // weather: function (e) {
    //   if (!this.weatherOn) {
    //     this.weatherLayers.addLayer(this.temperature);
    //     this.weatherLayers.addLayer(this.precipitation);
    //     this.cragsLayer.setOpacity(.25);
    //   } else {
    //     this.weatherLayers.clearLayers();
    //     this.cragsLayer.setOpacity(1);
    //   }
    //   this.weatherOn = !this.weatherOn;
    // },

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
