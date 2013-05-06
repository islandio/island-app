/*
 * Footer view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone'
], function ($, _, Backbone) {
  return Backbone.View.extend({
    
    el: '#footer',
    
    initialize: function (app) {

      // Save app reference.
      this.app = app;

    },

    render: function () {

      // UnderscoreJS templating:
      // this.$el.html(_.template(template).call(this)).show();

      return this;
    },

    // Bind mouse events.
    events: {},

  });
});
