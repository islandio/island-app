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

    // Location of images that must remain remote.
    this.images = {
      avatar: 'https://s3.amazonaws.com/island.io/avatar_48.png',
      avatar_big: 'https://s3.amazonaws.com/island.io/avatar_274.png'
    };

    // Grades.
    this.grades = ['9c+', '9c', '9b+', '9b', '9a+', '9a', '8c+', '8c',
        '8b+', '8b', '8a+', '8a', '7c+', '7c', '7b+', '7b', '7a+', '7a',
        '6c+', '6c', '6b+', '6b', '6a+', '6a', '5c', '5b', '5a', '4', '3'];

    this.cartodb = {
      apiKey: '883965c96f62fd219721f59f2e7c20f08db0123b',
      sqlPre: "select *, st_asgeojson(the_geom) as geometry from "
          + (window.__s ? 'crags': 'crags_dev')
          + " where forbidden is NULL",
    };

    // For local dev.
    if (window.__s === '') {
      window._rpc = rpc;
      window._rest = rest;
      window._mps = mps;
    }
  }

  App.prototype.update = function (profile) {
    var login = false;

    // Set the app profile.
    if (this.profile) {
      this.profile.content = profile.content;
      this.profile.sub = profile.sub;
      this.profile.weather = profile.weather;
      if (profile.member && !this.profile.member) {
        this.profile.member = profile.member;
        this.profile.notes = profile.notes;
        this.profile.transloadit = profile.transloadit;
        login = true;
      }
    } else {
      this.profile = profile;
    }
    return login;
  }

  App.prototype.title = function (str) {
    if (!str) {
      return;
    }
    document.title = str;
  }

  return {

    init: function () {
      var app = new App();
      $('body').removeClass('preload');
      app.router = new Router(app);
      Backbone.history.start({pushState: true});

      // Kill app on logout. Useful when
      // - a member has more than one active session,
      // - we want to logout everyone remotely (ninja).
      app.rpc.socket.on('logout', function () {
        window.location.href = '/';
      });

      // For local dev.
      if (window.__s === '') {
        window._app = app;
        console.log('island dev');
      } else {
        console.log('island ' + _.str.strRightBack(window.__s, '/'));
      }
    }
    
  };
});
