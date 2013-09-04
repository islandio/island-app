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
  'views/signin',
  'views/lists/notifications',
  'views/map',
  'views/rows/profile',
  'views/rows/post',
  'views/crag',
  'views/ascent',
  'views/settings',
  'views/team',
  'views/films',
  'views/about',
  'views/contact',
  'views/privacy',
  'views/home'
], function ($, _, Backbone, Spin, mps, rpc, util, Error, Header, Footer, 
    Signin, Notifications, Map, Profile, Post, Crag, Ascent, Settings,
    Team, Films, About, Contact, Privacy, Home) {

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
      this.route('team', 'team', this.team);
      this.route('films', 'films', this.films);
      this.route('about', 'about', this.about);
      this.route('contact', 'contact', this.contact);
      this.route('privacy', 'privacy', this.privacy);
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

    start: function () {
      $(window).scrollTop(0);
      this.spin.target.show();
      this.spin.start();
    },

    stop: function () {
      this.spin.target.hide();
      this.spin.stop();
      $(window).scrollTop(0);
    },

    profile: function (username) {
      this.start();
      this.render('/service/profile.profile/' + username,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile({wrap: '#main'}, this.app).render(true);
        this.stop();
      }, this));
    },

    post: function (username, key) {
      this.start();
      var key = [username, key].join('/');
      this.render('/service/post.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Post({wrap: '#main'}, this.app).render(true);
        this.stop();
      }, this));
    },

    crag: function (country, crag) {
      this.start();
      var key = [country, crag].join('/');
      this.render('/service/crag.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app).render();
        this.stop();
      }, this));
    },

    ascent: function (country, crag, type, ascent) {
      this.start();
      var key = [country, crag, type, ascent].join('/');
      this.render('/service/ascent.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app).render();
        this.stop();
      }, this));
    },

    home: function () {
      this.start();
      this.render('/service/home.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Home(this.app).render();
        this.stop();
      }, this));
    },

    settings: function () {
      this.start();
      this.render('/service/settings.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.stop();
      }, this));
    },

    team: function () {
      this.start();
      this.render('/service/team.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Team(this.app).render();
        this.stop();
      }, this));
    },

    films: function () {
      this.start();
      this.render('/service/films.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Films(this.app).render();
        this.stop();
      }, this));
    },

    about: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new About(this.app).render();
        this.stop();
      }, this));
    },

    contact: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Contact(this.app).render();
        this.stop();
      }, this));
    },

    privacy: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Privacy(this.app).render();
        this.stop();
      }, this));
    },

    default: function (actions) {
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Error(this.app).render({
          code: 404,
          message: 'Sorry, this page isn\'t available'
        });
      }, this));
    }
  
  });
  
  return Router;

});
