/*
 * Page view for splash page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/banner.html',
  'text!../../templates/splash.html'
], function ($, _, Backbone, mps, util, banner, template) {
  return Backbone.View.extend({

    el: '.folder',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Train · Climb');
      this.$('.main').html(_.template(template).call(this));

      this.template = _.template(template);
      this.$('.banner').html(_.template(banner).call(this));

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    setup: function () {

      // Embed the background video.
      swfobject.embedSWF(
          __s + '/swf/roll.swf', 'roll', '100%', '100%', '10',
          false, {}, {menu: 'false', wmode: 'opaque'});
      _.delay(_.bind(function () {
        this.$('.banner-roll').css({opacity: 1});
      }, this), 300);

      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.$('.banner').empty();
      this.$('.main').empty();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
