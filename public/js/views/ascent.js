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
  'views/lists/events'
], function ($, _, Backbone, mps, rest, util, Ascent, template, title, Events) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Ascent(this.app.profile.content.page);
      this.setTitle();
      this.title = _.template(title).call(this);

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

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
        hide: []
      });

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
      this.events.destroy();
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
      this.app.title('Island | ' + this.model.get('name')
          + ' - ' + [this.model.get('crag'),
          this.model.get('country')].join(', '));
    }

  });
});
