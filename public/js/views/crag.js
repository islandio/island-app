/*
 * Page view for a crag profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/crag',
  'text!../../templates/crag.html',
  'text!../../templates/crag.title.html',
  'views/lists/events',
  'views/lists/ascents',
  'views/lists/watchers',
  'views/instafeed',
  'text!../../../templates/confirm.html',
  'Skycons'
], function ($, _, Backbone, mps, rest, util, Crag, template, title,
      Events, Ascents, Watchers, Instafeed, confirm) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];

      if (this.options.config) {
        this.subscriptions.push(
          mps.subscribe('map/plot', _.bind(this.setLocation, this))
        );
      }

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Crag(this.app.profile.content.page);
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.setTitle();
      this.title = _.template(title).call(this);

      // Init weather icon.
      _.defer(_.bind(function () {
        var weather = this.app.profile.weather;
        if (weather) {
          this.skycons = new Skycons({'color': '#666', static: true});
          var iconName = weather.icon.replace(/-/g, '_').toUpperCase();
          this.skycons.add('crag_weather', weather.icon);
        }
      }, this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'change .settings-param': 'save',
      'click .demolish': 'demolish'
    },

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Enable location updates.
      if (this.options.config) {
        mps.publish('map/listen');
      }

      // Render events.
      if (!this.options.config) {
        this.events = new Events(this.app, {
          parentView: this,
          parentId: this.model.id,
          parentType: 'crag',
          reverse: true,
          input: true,
          filters: ['session', 'post', 'ascent'],
          hide: ['ascent']
        });
      }

      // Render lists.
      this.watchers = new Watchers(this.app, {parentView: this, reverse: true});

      // Render ascents.
      this.ascents = new Ascents(this.app).render({
        data: {
          country: this.model.get('country'),
          ascents: this.model.get('ascents'),
          bcnt: this.model.get('bcnt'),
          rcnt: this.model.get('rcnt')
        }
      });

      // Grab an Instsgram feed.
      if (!this.options.config) {
        this.instafeed = new Instafeed(this.app, {
          el: this.$('#ig_tagged'),
          tags: this.model.instagramTags(),
        }).render();
      }

      // Handle text area height.
      this.$('textarea').autogrow();

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.skycons) {
        this.skycons.remove('crag-weather');
      }
      if (this.options.config) {
        mps.publish('map/listen');
      }
      this.watchers.destroy();
      this.ascents.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    setTitle: function () {
      var title = 'The Island | ' + [this.model.get('name'),
          this.model.get('country')].join(', ');
      if (this.options.config) {
        title += ' - Settings';
      }
      this.app.title(title);
    },

    setLocation: function (location) {
      mps.publish('map/start');

      this.save(null, {
        'location.latitude': location.latitude,
        'location.longitude': location.longitude
      }, _.bind(function () {
        this.$('[name="location.latitude"]').val(location.latitude)
            .data('saved', location.latitude);
        this.$('[name="location.longitude"]').val(location.longitude)
            .data('saved', location.longitude);
        this.model.set('location', location);
      }, this));
    },

    // Save the field(s).
    save: function (e, fields, cb) {
      var payload = {};

      if (fields) {
        payload = fields;
      } else {
        var field = $(e.target);
        var name = field.attr('name');
        var val = util.sanitize(field.val());

        // Create the paylaod.
        if (val === field.data('saved')) {
          return false;
        }

        payload[name] = val;

        var location = this.model.get('location');
        if (name === 'location.latitude') {
          mps.publish('map/start');
          if (location.longitude) {
            payload['location.longitude'] = location.longitude;
          }
        }
        if (name === 'location.longitude') {
          mps.publish('map/start');
          if (location.latitude) {
            payload['location.latitude'] = location.latitude;
          }
        }
      }

      // Now do the save.
      rest.put('/api/crags/' + this.model.get('key'), payload,
          _.bind(function (err, data) {
        if (err) {
          if (err.type === 'LENGTH_INVALID') {
            field.val(field.data('saved'));
          }
          if (err.message === 'no country code found') {
            err.message = 'Hmm, are you sure there\'s a crag there?';
          }
          mps.publish('flash/new', [{err: err, level: 'error'}]);
        } else {

          // Save the saved state.
          if (fields) {
            cb();
          } else if (val) {
            field.data('saved', val);
            if (name === 'location.latitude') {
              location.latitude = Number(val);
              this.model.set('location', location);
            }
            if (name === 'location.longitude') {
              location.longitude = Number(val);
              this.model.set('location', location);
            }
          }

          // Show saved status.
          mps.publish('flash/new', [{
            message: 'Saved.',
            level: 'alert',
            type: 'popup'
          }, true]);
        }

        // Refresh map.
        if (fields || name === 'location.latitude' ||
            name === 'location.longitude') {
          mps.publish('map/refresh/crags');
        }

        // Crag's URL changed so refresh.
        if (this.model.get('key') !== data.key) {
          this.model.set('key', data.key);
          this.app.router.navigate('/crags/' + data.key + '/config',
              {trigger: true});
        }

      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this crag forever? All associated content and activity' +
            ' will be deleted.',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the user.
        rest.delete('/api/crags/' + this.model.get('key'), _.bind(function (err) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error', type: 'popup'},
                true]);
            return false;
          }
          mps.publish('flash/new', [{
            message: 'You deleted the crag ' + this.model.get('name') + '.',
            level: 'alert'
          }, true]);

          // Route to country home.
          var code = this.model.get('key').split('/')[0];
          this.app.router.navigate('/crags/' + code, {trigger: true});

          // Close the modal.
          $.fancybox.close();

          // Force new map query cause map cache is sticky.
          mps.publish('map/refresh/crags');
          mps.publish('map/fit');
        }, this));
      }, this));

      return false;
    },

  });
});
