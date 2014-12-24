/*
 * View an instafeed.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Instafeed'
], function ($, _, Backbone, Instafeed) {
  return Backbone.View.extend({

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.setElement(options.el);
    },

    render: function () {
      var self = this;
      new Instafeed({
        target: this.$el.attr('id'),
        get: 'tagged',
        tagName: this.options.tags,
        clientId: this.app.instagram.clientId,
        template: '<a href="{{link}}" target="blank">'
            + '<img class="ig-img" src="{{image}}" width="66" height="66"/></a>',
        limit: 30,
        success: function (res) {
          var n = res.data.length || 1;
          var h = 28 + Math.ceil(n / 10) * 68;
          self.$el.data('height', h);
        },
        after: function () {
          self.$('.ig-img').show();
          if (self.$el.data('height') > 96) {
            self.$('.instagrams-all').show().click(function (e) {
              self.$el.height(self.$el.data('height')).addClass('open');
            });
          }
        },
        error: function (e) {
          $('<span class="empty-feed">Nothing to see here yet.</span>')
              .appendTo(self.$el);
        }
      }).run();
      return this;
    }

  });
});
