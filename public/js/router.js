/*
 * Handle URL paths and changes.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'views/error',
  'views/header',
  'views/footer',
  'views/signin',
  'views/lists/notifications',
  'views/map',
  'views/home',
  'views/profile',
  'views/settings',
  'views/rows/post',
  'views/crag',
  'views/ascent'
], function ($, _, Backbone, mps, rpc, util, Error, Header, Footer, Signin,
      Notifications, Map, Home, Profile, Settings, Post, Crag, Ascent) {

  // Our application URL router.
  var Router = Backbone.Router.extend({

    initialize: function (app) {

      // Save app reference.
      this.app = app;
      
      // Clear the shit that comes back from Zuckbook.
      if (window.location.hash !== '')
        try {
          window.history.replaceState('', '', window.location.pathname
              + window.location.search);
        } catch(err) {}
      
      // Page routes:
      this.route(':un', 'profile', this.profile);
      this.route(':un/:k', 'post', this.post);
      this.route('crags/:y/:g', 'crag', this.crag);
      this.route('crags/:y/:g/:t/:a', 'ascent', this.ascent);
      this.route('settings', 'profile', this.settings);
      this.route('', 'home', this.home);

      // Fullfill navigation request from mps.
      mps.subscribe('navigate', _.bind(function (path) {
        this.navigate(path, {trigger: true});
      }, this));

      // Kill the notifications view.
      mps.subscribe('member/delete', _.bind(function () {
        this.notifications.destroy();
      }, this));

      // Show the signin modal.
      mps.subscribe('member/signin/open', _.bind(function () {
        this.signin = new Signin(this.app).render();
      }, this));
    },

    routes: {
      // Catch all:
      '*actions': 'default'
    },

    render: function (service, cb) {

      function _render(err) {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();
        if (!this.footer)
          this.footer = new Footer(this.app).render();
        if (!this.map)
          this.map = new Map(this.app).render();
        if (!this.notifications && this.app.profile && this.app.profile.member)
          this.notifications = new Notifications(this.app, {reverse: true});

        // Callback to route.
        cb(err);
      }

      // Kill the page view if it exists.
      if (this.page)
        this.page.destroy();

      if (typeof service === 'function') {
        cb = service;
        return _render.call(this);
      }

      // Check if a profile exists already.
      var query = this.app.profile
          && this.app.profile.notes ? {n: 0}: {};

      // Get a profile, if needed.
      rpc.get(service, query,
          _.bind(function (err, pro) {
        if (err) {
          _render.call(this, err);
          return this.page = new Error(this.app).render(err);
        }

        // Set the profile.
        this.app.update(pro);
        _render.call(this);

      }, this));
    },

    home: function () {
      this.render('/service/home.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Home(this.app).render();
      }, this));
    },

    profile: function (username) {
      this.render('/service/member.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
      }, this));
    },

    settings: function () {
      this.render('/service/settings.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
      }, this));
    },

    post: function (username, key) {
      var key = [username, key].join('/');
      this.render('/service/post.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Post({wrap: '#main'}, this.app).render(true);
      }, this));
    },

    crag: function (country, crag) {
      var key = [country, crag].join('/');
      this.render('/service/crag.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app).render();
      }, this));
    },

    ascent: function (country, crag, type, ascent) {
      var key = [country, crag, type, ascent].join('/');
      this.render('/service/ascent.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app).render();
      }, this));
    },

    default: function (actions) {
      console.warn('No route:', actions);
    }
  
  });
  
  return Router;

});
