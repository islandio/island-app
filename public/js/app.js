/*
 * Island application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'GradeConverter',
  'mps',
  'rpc',
  'rest',
  'util'
], function ($, _, Backbone, Router, GradeConverter, mps, rpc, rest, util) {

  var App = function () {
    this.rpc = rpc.init();

    // Location of images that must remain remote.
    this.images = {
      avatar: 'https://s3.amazonaws.com/island.io/avatar_48.png',
      avatar_big: 'https://s3.amazonaws.com/island.io/avatar_325.png',
      banner: 'https://s3.amazonaws.com/island.io/banner_680.png',
      banner_big: 'https://s3.amazonaws.com/island.io/banner_1024.png'
    };

    this.gradeConverter = {
      'b': new GradeConverter('boulders').from('font').to('default'),
      'r': new GradeConverter('routes').from('french').to('default')
    };

    this.cartodb = {
      sqlPre: "select *, st_asgeojson(the_geom) as geometry from " +
          (window.__s ? 'crags': 'crags_dev') +
          " where (forbidden is NULL or forbidden is FALSE)"
    };
    this.instagram = {
      clientId: window.__s ? 'a3003554a308427d8131cef13ef2619f':
          'b6e0d7d608a14a578cf94763f70f1b49'
    };

    if (window.__s === '') {
      window._rpc = rpc;
      window._rest = rest;
      window._mps = mps;
    }
  };

  App.prototype.update = function (profile) {
    var login = false;

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
  };

  App.prototype.title = function (str) {
    if (!str) {
      return;
    }
    document.title = str;
  };

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

      if (window.__s === '') {
        window._app = app;
        console.log('island dev');
      } else {
        console.log('island ' + _.str.strRightBack(window.__s, '/'));
      }
    }
    
  };
});
