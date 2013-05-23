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

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function () {
      return this;
    },

    // Bind mouse events.
    events: {},

  });
});
