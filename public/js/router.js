/*
 * Handle URL paths and changes.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Spin',
  'mps',
  'rest',
  'util',
  'views/error',
  'views/header',
  'views/tabs',
  'views/footer',
  'views/signin',
  'views/forgot',
  'views/lists/notifications',
  'views/map',
  'views/rows/profile',
  'views/rows/post',
  'views/rows/session',
  'views/crag',
  'views/ascent',
  'views/settings',
  'views/reset',
  'views/films',
  'views/about',
  'views/privacy',
  'views/crags',
  'views/dashboard',
  'views/session.new'
], function ($, _, Backbone, Spin, mps, rest, util, Error, Header, Tabs, Footer, 
    Signin, Forgot, Notifications, Map, Profile, Post, Session, Crag, Ascent,
    Settings, Reset, Films, About, Privacy, Crags, Dashboard, NewSession) {

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

      // Page routes.
      this.route(':un', 'profile', this.profile);
      this.route(':un/:k', 'post', this.post);
      this.route('sessions/:k', 'session', this.session);
      this.route('crags/:y/:g', 'crag', this.crag);
      this.route('crags/:y/:g/:t/:a', 'ascent', this.ascent);
      this.route('reset', 'reset', this.reset);
      this.route('settings', 'settings', this.settings);
      this.route('films', 'films', this.films);
      this.route('about', 'about', this.about);
      this.route('privacy', 'privacy', this.privacy);
      this.route('sessions/new', 'newSession', this.newSession);
      this.route('dashboard', 'dashboard', this.dashboard);
      this.route('crags', 'crags', this.crags);
      this.route('_blank', 'blank', function(){});

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
        this.modal = new Signin(this.app).render();
      }, this));

      // Show the forgot modal.
      mps.subscribe('member/forgot/open', _.bind(function () {
        this.modal = new Forgot(this.app).render();
      }, this));

      // Init page spinner.
      this.spin = new Spin($('.page-spin'), {color: '#808080'});
    },

    routes: {

      // Catch all.
      '*actions': 'default'
    },

    render: function (service, data, secure, cb) {

      function _render(err, login) {

        // Render page elements.
        if (!this.header)
          this.header = new Header(this.app).render();
        else if (login) this.header.render(true);
        if (!this.map)
          this.map = new Map(this.app).render();
        else this.map.update();
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
      if (typeof data === 'function') {
        cb = data;
        data = {};
      }
      if (typeof secure === 'function') {
        cb = secure;
        secure = false;
      }

      // Check if a profile exists already.
      var query = this.app.profile
          && this.app.profile.notes ? {n: 0}: {};
      _.extend(query, data);

      // Get a profile, if needed.
      rest.get(service, query, _.bind(function (err, pro) {
        if (err) {
          // _render.call(this, err);
          this.page = new Error(this.app).render(err);
          this.spin.stop();
        }
        if (secure && !pro.member)
          return this.navigate('/', true);

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);

      }, this));
    },

    renderTabs: function (params) {
      if (this.tabs) {
        this.tabs.params = params || {};
        this.tabs.render();
      } else
        this.tabs = new Tabs(this.app, params).render();
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
      var feed = store.get('feed') || {};
      if (!feed.query) feed.query = {featured: true};
      this.renderTabs();
      this.render('/service/profile.profile/' + username, feed,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    post: function (username, key) {
      this.start();
      var key = [username, key].join('/');
      this.renderTabs();
      this.render('/service/post.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Post({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    session: function (key) {
      this.start();
      this.renderTabs();
      this.render('/service/session.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Session({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    crag: function (country, crag) {
      this.start();
      var key = [country, crag].join('/');
      this.renderTabs();
      this.render('/service/crag.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    ascent: function (country, crag, type, ascent) {
      this.start();
      var key = [country, crag, type, ascent].join('/');
      this.renderTabs();
      this.render('/service/ascent.profile/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    crags: function () {
      this.start();
      this.render('/service/crags.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Crags(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({tabs: [
        {title: 'Activity', href: '/dashboard'},
        {title: 'Crags', href: '/crags', active: true}
      ]});
    },

    dashboard: function () {
      this.start();
      var feed = store.get('feed') || {};
      if (!feed.actions || feed.actions === 'all')
        feed.actions = ['session', 'post'];
      else if (feed.actions === 'session')
        feed.actions = ['session'];
      else if (feed.actions === 'post')
        feed.actions = ['post'];
      if (feed.query && feed.query.author_id)
        delete feed.query.author_id;
      this.render('/service/dashboard.profile', feed, _.bind(function (err) {
        if (err) return;
        this.page = new Dashboard(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({tabs: [
        {title: 'Activity', href: '/dashboard', active: true},
        {title: 'Crags', href: '/crags'}
      ]});
    },

    settings: function () {
      this.start();
      this.render('/service/settings.profile', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Account Settings'});
    },

    newSession: function () {
      this.start();
      this.render('/service/session.new.profile', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new NewSession(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Log new session'});
    },

    reset: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Password reset'});
    },

    films: function () {
      this.start();
      this.render('/service/films.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Films(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Films', subtitle: 'Original content by Island'});
    },

    about: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new About(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'About', subtitle: 'What\'s going on here?'});
    },

    privacy: function () {
      this.start();
      this.render('/service/static.profile', _.bind(function (err) {
        if (err) return;
        this.page = new Privacy(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Privacy Policy', subtitle: 'Last updated 7.27.2013'});
    },

    default: function () {
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Error(this.app).render({
          code: 404,
          message: 'Sorry, this page isn\'t available'
        });
      }, this));
      this.renderTabs();
    }
  
  });
  
  return Router;

});
