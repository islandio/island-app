/*
 * Island application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'mps',
  'rpc',
  'rest'
], function ($, _, Backbone, Router, mps, rpc, rest) {

  var App = function () {

    // Save connection to server.
    this.rpc = rpc.init();

    // Location of static assets
    this.cfuri = 'https://d10fiv677oa856.cloudfront.net';

    // App model subscriptions.
    mps.subscribe('member/delete', _.bind(this.logout, this));

    // For local dev.
    if (window.__s === '') {
      window._rpc = rpc;
      window._rest = rest;
      window._mps = mps;
    }
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      this.profile.sub = profile.sub;
      if (profile.member && !this.profile.member) {
        this.profile.member = profile.member;
        this.profile.notes = profile.notes;
        this.profile.transloadit = profile.transloadit;
        return true;
      }
    } else
      this.profile = profile;

    return false;
  }

  App.prototype.title = function (str) {

    // Set the document title.
    document.title = str;
  }

  App.prototype.logout = function () {

    // Update app profile.
    delete this.profile.member;
    delete this.profile.notes;
    delete this.profile.transloadit;
  }

  return {

    // Creates the instance.
    init: function () {
      $('body').removeClass('preload');
      var app = new App;
      app.router = new Router(app);
      Backbone.history.start({pushState: true});

      // For local dev.
      if (window.__s === '') window._app = app;
    }
    
  };
});
