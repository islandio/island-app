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
  'Skycons'
], function ($, _, Backbone, mps, rest, util, Crag, template, title,
      Events, Ascents, Watchers, Instafeed) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
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
      'click .navigate': 'navigate'
    },

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render events.
      this.events = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'crag',
        reverse: true,
        input: true,
        filters: ['session', 'post', 'ascent'],
        hide: ['ascent']
      });

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
      this.instafeed = new Instafeed(this.app, {
        el: this.$('#ig_tagged'),
        tags: this.model.instagramTags(),
      }).render();

      // Adjust height.
      
      // this.$el.height(this.$('.rightside').outerHeight());

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
      this.app.title('The Island | ' + [this.model.get('name'),
          this.model.get('country')].join(', '));
    }

  });
});
