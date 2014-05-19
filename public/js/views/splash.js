/*
 * Page view for splash page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/splash.html'
], function ($, _, Backbone, mps, util, template) {
  return Backbone.View.extend({

    el: '.folder',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Train / Climb');
      this.template = _.template(template);
      this.$('.main').html(this.template.call(this));

      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Embed the background video.
      // $('<div id="roll" class="roll"></div>').appendTo(this.$('.banner'));
      // swfobject.embedSWF(
      //     __s + '/swf/roll.swf', 'roll', '100%', 'auto', '10',
      //     false, {}, {menu: 'false', wmode: 'opaque'});

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

  });
});
