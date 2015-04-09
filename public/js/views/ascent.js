/*
 * Page view for an ascent profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/ascent',
  'text!../../templates/ascent.html',
  'text!../../templates/ascent.title.html',
  'views/lists/events',
  'views/lists/watchers',
  'views/instafeed'
], function ($, _, Backbone, mps, rest, util, Ascent, template, title, Events,
      Watchers, Instafeed) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Ascent(this.app.profile.content.page);
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.setTitle();
      this.title = _.template(title).call(this);

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
      'click .navigate': 'navigate'
    },

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render events.
      this.events = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'ascent',
        reverse: true,
        input: true,
        filters: ['tick', 'post'],
        filterTitles: ['Efforts', 'Posts'],
        feedStore: 'ascentFeed',
        hide: []
      });

      // Render lists.
      this.watchers = new Watchers(this.app, {parentView: this, reverse: true});

      // Grab an Instsgram feed.
      this.instafeed = new Instafeed(this.app, {
        el: this.$('#ig_tagged'),
        tags: this.model.instagramTags(),
      }).render();

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
      this.events.destroy();
      this.watchers.destroy();
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
      this.app.title('The Island | ' + this.model.get('name')
          + ' - ' + [this.model.get('crag'),
          this.model.get('country')].join(', '));
    }

  });
});
