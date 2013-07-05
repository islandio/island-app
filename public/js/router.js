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
  'views/header',
  'views/footer',
  'views/signin',
  'views/lists/notifications',
  'views/map',
  'views/home',
  'views/profile',
  'views/settings',
  'views/rows/post'
], function ($, _, Backbone, mps, rpc, util, Header, Footer, Signin,
      Notifications, Map, Home, Profile, Settings, Post) {

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

      function _render() {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();
        if (!this.footer)
          this.footer = new Footer(this.app).render();
        if (!this.map)
          this.map = new Map(this.app).render();
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
