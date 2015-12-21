/*
 * Page view for all media activity.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/medias.html',
  'views/lists/medias'
], function ($, _, Backbone, mps, util, template, Medias) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.setTitle();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');

      return this;
    },

    setup: function () {
      this.feed = new Medias(this.app, {
        parentView: this,
        reverse: true,
        filters: false
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
      this.feed.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    setTitle: function () {
      this.app.title('Island | Recent Media');
    }

  });
});
