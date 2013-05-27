/*
 * Island application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Pusher',
  'router',
  'rpc'
], function ($, _, Backbone, Pusher, Router, rpc) {

  // For dev:
  window._rpc = rpc;

  var App = function () {
    
    // Open a socket:
    this.socket = new Pusher('37fea545f4a0ce59464c');

    // Location of static assets:
    this.cloudFrontURL = 'https://d271mvlc6gc7bl.cloudfront.net';
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile)
      this.profile.content = profile.content;
    else
      this.profile = profile;
  }

  App.prototype.title = function (str) {

    // Set the document title.
    document.title = 'Island | ' + str;
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
