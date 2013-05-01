/*
 * Island application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'rpc'
], function ($, _, Backbone, Router, rpc) {

  // For dev:
  window._rpc = rpc;

  var App = function () {
    
    // Location of static assets:
    this.cloudFrontURL = 'https://d2nwkk2kh4qkau.cloudfront.net';
  }

  App.prototype.update = function (profile) {

    // Set the app profile model.
    this.profile = new Backbone.Model(profile);
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App;
      app.router = new Router(app);
      Backbone.history.start({pushState: true});
    }
    
  };
});
