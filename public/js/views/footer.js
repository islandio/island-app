/*
 * Footer view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone'
], function ($, _, Backbone) {
  return Backbone.View.extend({
    
    el: 'footer.footer',
    
    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
    },

    render: function () {
      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
