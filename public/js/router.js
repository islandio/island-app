/*
 * Handle URL paths and changes.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'views/header',
  'views/footer',
  'views/lists/notifications',
  'views/map',
  'views/home',
  'views/login',
  'views/profile',
  'views/settings',
  'views/rows/post'
], function ($, _, Backbone, mps, rpc, Header, Footer,
      Notifications, Map, Home, Login, Profile, Settings, Post) {

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
      this.route(':username', 'profile', this.profile);
      this.route(':username/:key', 'post', this.post);
      this.route('settings', 'profile', this.settings);
      this.route('login', 'login', this.login);
      this.route('', 'home', this.home);

      // Subscriptions
      mps.subscribe('navigate', _.bind(function (path) {

        // Fullfill navigation request from mps.
        this.navigate(path, {trigger: true});
      }, this))
    },

    routes: {
      // Catch all:
      '*actions': 'default'
    },

    render: function (service, cb) {

      function _render() {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();
        if (!this.footer)
          this.footer = new Footer(this.app).render();
        if (!this.map)
          this.map = new Map(this.app).render();
        else this.map.render();
        if (!this.notifications && this.app.profile.member)
          this.notifications = new Notifications(this.app, {reverse: true});

        // Callback to route.
        cb();
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
        if (err) return console.error(err.stack);

        // Set the profile.
        this.app.update(pro);
        _render.call(this);

      }, this));
    },

    login: function () {
      this.page = new Login(this.app).render();
    },

    home: function () {
      this.render('/service/home.profile', _.bind(function () {
        this.page = new Home(this.app).render();
      }, this));
    },

    profile: function (username) {
      this.render('/service/member.profile/' + username,
          _.bind(function () {
        this.page = new Profile(this.app).render();
      }, this));
    },

    settings: function () {
      this.render('/service/settings.profile', _.bind(function () {
        this.page = new Settings(this.app).render();
      }, this));
    },

    post: function (username, key) {
      var key = [username, key].join('/');
      this.render('/service/post.profile/' + key, _.bind(function () {
        this.page = new Post({wrap: '#main'}, this.app).render(true);
      }, this));
    },

    default: function (actions) {
      console.warn('No route:', actions);
    }
  
  });
  
  return Router;

});
