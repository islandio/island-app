/*
 * Handle URL paths and changes.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Spin',
  'mps',
  'rpc',
  'util',
  'views/error',
  'views/header',
  'views/footer',
  'views/films',
  'views/privacy',
  'views/about',
  'views/signin',
  'views/lists/notifications',
  'views/map',
  'views/home',
  'views/profile',
  'views/settings',
  'views/rows/post',
  'views/crag',
  'views/ascent'
], function ($, _, Backbone, Spin, mps, rpc, util, Error, Header, Footer, Films,
    Privacy, About, Signin, Notifications, Map, Home, Profile, Settings, Post,
    Crag, Ascent) {

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
        } catch (err) {}

      // Page routes:
      this.route(':un', 'profile', this.profile);
      this.route(':un/:k', 'post', this.post);
      this.route('crags/:y/:g', 'crag', this.crag);
      this.route('crags/:y/:g/:t/:a', 'ascent', this.ascent);
      this.route('settings', 'settings', this.settings);
      this.route('about', 'about', this.about);
      this.route('privacy', 'privacy', this.privacy);
      this.route('films', 'films', this.films);
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

      // Init page spinner.
      this.spin = new Spin($('#page_spin'), {
        color: '#b3b3b3',
        lines: 17,
        length: 7,
        width: 3,
        radius: 12
      });
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
          this.page = new Error(this.app).render(err);
          this.spin.stop();
          return;
        }

        // Set the profile.
        this.app.update(pro);
        _render.call(this);

      }, this));
    },

    home: function () {
      this.spin.start();
      this.render('/service/home.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Home(this.app).render();
        this.spin.stop();
      }, this));
    },

    films: function () {
      this.spin.start();
      this.render('/service/films.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Films(this.app).render();
        this.spin.stop();
      }, this));
    },

    privacy: function () {
      this.spin.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Privacy(this.app).render();
        this.spin.stop();
      }, this));
    },

    about: function () {
      this.spin.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new About(this.app).render();
        this.spin.stop();
      }, this));
    },

    settings: function () {
      this.spin.start();
      this.render('/service/settings.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.spin.stop();
      }, this));
    },

    profile: function (username) {
      this.spin.start();
      this.render('/service/member.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
        this.spin.stop();
      }, this));
    },

    post: function (username, key) {
      this.spin.start();
      var key = [username, key].join('/');
      this.render('/service/post.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Post({wrap: '#main'}, this.app).render(true);
        this.spin.stop();
      }, this));
    },

    crag: function (country, crag) {
      this.spin.start();
      var key = [country, crag].join('/');
      this.render('/service/crag.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app).render();
        this.spin.stop();
      }, this));
    },

    ascent: function (country, crag, type, ascent) {
      this.spin.start();
      var key = [country, crag, type, ascent].join('/');
      this.render('/service/ascent.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app).render();
        this.spin.stop();
      }, this));
    },

    default: function (actions) {
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Error(this.app).render({
          notice: 'Sorry, this page isn\'t available'
        });
      }, this));
    }
  
  });
  
  return Router;

});
