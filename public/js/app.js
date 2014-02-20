/*
 * Island application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Pusher',
  'router',
  'mps',
  'rpc'
], function ($, _, Backbone, Pusher, Router, mps, rpc) {

  // For dev:
  window._rpc = rpc;
  window._mps = mps;

  var App = function () {

    // Open a socket.
    this.socket = window.__s === '' ?
        new Pusher('37fea545f4a0ce59464c'):
        new Pusher('c260ad31dfbb57bddd94');

    // Location of static assets
    this.cfuri = 'https://d10fiv677oa856.cloudfront.net';

    // App model subscriptions.
    mps.subscribe('member/delete', _.bind(this.logout, this))
  }

  App.prototype.update = function (profile) {

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      if (profile.sub)
        this.profile.sub = profile.sub;
      if (profile.member && !this.profile.member) {
        this.profile.member = profile.member;
        this.profile.notes = profile.notes;
        this.profile.sub = profile.sub;
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
      var app = new App;
      app.router = new Router(app);
      Backbone.history.start({pushState: true});
    }
    
  };
});
