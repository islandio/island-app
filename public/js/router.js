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
  'views/signup',
  'views/forgot',
  'views/lists/notifications',
  'views/map',
  'views/profile',
  'views/rows/post',
  'views/rows/session',
  'views/rows/tick',
  'views/crag',
  'views/admin',
  'views/ascent',
  'views/settings',
  'views/reset',
  'views/films',
  'views/static',
  'views/crags',
  'views/dashboard',
  'views/splash',
  'views/ticks',
  'text!../templates/about.html',
  'text!../templates/privacy.html',
], function ($, _, Backbone, Spin, mps, rest, util, Error, Header, Tabs, Footer,
    Signin, Signup, Forgot, Notifications, Map, Profile, Post, Session, Tick,
    Crag, Admin, Ascent, Settings, Reset, Films, Static, Crags, Dashboard, Splash,
    Ticks, aboutTemp, privacyTemp) {

  /*
   * Determine if parent is iframe.
   */
  function inIframe () {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  var Router = Backbone.Router.extend({

    loading: false,
    loadingQueue: [],

    initialize: function (app) {
      this.app = app;
      
      // Clear the hashtag that comes back from facebook.
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1) {
        if (window.location.hash.length === 0 || window.location.hash === '#_=_') {
          try {
            window.history.replaceState('', '', window.location.pathname
                + window.location.search);
          } catch (err) {}
        }
      }

      // Init page spinner.
      this.spin = new Spin($('.page-spin'), {color: '#808080'});
      this.start(true);

      // Page routes.
      this.route(':un', 'profile', this.profile);
      this.route(':un/:k', 'post', this.post);
      this.route(':un/ascents', 'ticks', this.ticks);

      this.route('sessions/:k', 'session', this.session);
      this.route('efforts/:k', 'tick', this.tick);
      
      this.route('crags/:y', 'crag', this.crags);
      this.route('crags/:y/:g', 'crag', this.crag);
      this.route('crags/:y/:g/:t/:a', 'ascent', this.ascent);
      
      this.route('reset', 'reset', this.reset);
      this.route('admin', 'admin', this.admin);
      this.route('settings', 'settings', this.settings);
      this.route('privacy', 'privacy', this.privacy);
      this.route('about', 'about', this.about);
      this.route('films', 'films', this.films);
      this.route('crags', 'crags', this.crags);
      this.route('signin', 'signin', this.signin);
      this.route('signup', 'signup', this.signup);
      this.route('', 'dashboard', this.dashboard);
      this.route('_blank', 'blank', function(){});

      // Save dom refs.
      this.folder = $('.folder');

      // Show the forgot modal.
      mps.subscribe('modal/forgot/open', _.bind(function () {
        this.modal = new Forgot(this.app).render();
      }, this));
    },

    routes: {
      '*actions': 'default' // Catch all
    },

    render: function (service, data, secure, cb) {

      function _render(err, login) {
        if (window.__s !== '') {
          ga('send', 'pageview');
          if (this.app.profile && this.app.profile.user) {
            ga('set', '&uid', this.app.profile.user.id);
          }
        }
        delete this.pageType;

        // Render page elements.
        if (!this.header) {
          this.header = new Header(this.app).render();
        } else if (login) {
          this.header.render(true);
        }
        this.header.highlight(window.location.pathname);
        if (!this.map && this.showMap) {
          this.map = new Map(this.app).render();
        }
        if (!this.notifications && this.app.profile && this.app.profile.member) {
          this.notifications = new Notifications(this.app, {reverse: true});
        }
        if (!this.footer) {
          this.footer = new Footer(this.app).render();
        }

        // Callback to route.
        cb(err);
      }

      // Grab hash for comment.
      this.app.requestedCommentId = null;
      if (window.location.hash !== '' || window.location.href.indexOf('#') !== -1) {
        var tmp = window.location.hash.match(/#c=([a-z0-9]{24})/i);
        if (tmp) {
          this.app.requestedCommentId = tmp[1];
        }
        tmp = window.location.hash.match(/#h=([a-z0-9]{24})/i);
        if (tmp) {
          this.app.requestedHangtenId = tmp[1];
        }
      }

      // Kill the page view if it exists.
      if (this.page) {
        this.page.destroy();
      }

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
          $('.container').removeClass('wide');
          this.stop();
          this.page = new Error(this.app).render(err);
        }
        if (secure && !pro.member) {
          return this.navigate('/', true);
        }

        if (pro.member)
          this.showMap = true;

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);
      }, this));
    },

    renderTabs: function (params) {
      if (this.tabs) {
        this.tabs.params = params || {};
        this.tabs.render();
      } else {
        this.tabs = new Tabs(this.app, params).render();
      }
    },

    start: function (skipQueue) {
      if (!skipQueue) {
        this.loadingQueue.push(1);
      }
      if (this.loading) {
        return;
      }
      this.loading = true;
      $(window).scrollTop(0);
      $('body').addClass('loading');
      $('footer').hide();
      this.spin.start();
    },

    stop: function () {
      this.loadingQueue.pop();
      if (this.loadingQueue.length !== 0) {
        return;
      }
      this.loading = false;
      _.defer(_.bind(function () {
        this.spin.stop();
        $(window).scrollTop(0);
        $('body').removeClass('loading');
        $('footer').show();
      }, this));
    },

    getEventActions: function () {
      var feed = store.get('feed') || {};
      return feed.actions || 'all';
    },

    getAscentEventActions: function () {
      var feed = store.get('ascentFeed') || {};
      return feed.actions || 'all';
    },

    // Routes //

    dashboard: function () {
      this.start();
      if (!this.tabs || !this.tabs.params.tabs || !this.tabs.params.tabs[1]
          || (this.tabs.params.tabs[1].href !== '/ascents')) {
        this.renderTabs();
      }
      var query = {actions: this.getEventActions()};
      this.render('/service/dashboard', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member) {
          $('.container').removeClass('wide').removeClass('landing');
          this.page = new Dashboard(this.app).render();
          this.renderTabs({tabs: [
            {title: 'Activity', href: '/', active: true},
            {title: 'My Ascents', href: '/' + this.app.profile.member.username
                + '/ascents'}
          ], log: true});
        } else {
          $('.container').addClass('wide').addClass('landing');
          this.page = new Splash(this.app).render();
        }
        this.stop();
      }, this));
    },

    ticks: function (username) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/ticks/' + username, _.bind(function (err) {
        if (err) return;
        this.page = new Ticks(this.app).render();
        if (this.app.profile.member
            && this.app.profile.member.username === username) {
          this.header.highlight('/');
          this.renderTabs({tabs: [
            {title: 'Activity', href: '/'},
            {title: 'My Ascents', href: '/' + username + '/ascents',
                active: true}
          ], log: true});          
        } else {
          this.renderTabs({html: this.page.title});
        }
        this.stop();
      }, this));
    },

    crags: function (country) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      var query = {};
      if (country) query.country = country;
      var q = util.getParameterByName('q');
      if (q) query.query = q;
      this.render('/service/crags', query, _.bind(function (err) {
        if (err) return;
        this.page = new Crags(this.app).render();
        this.renderTabs({title: 'Crags', subtitle: 'Climbing locations on Earth', log: true});
        this.stop();
      }, this));
    },

    films: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/films', _.bind(function (err) {
        if (err) return;
        this.page = new Films(this.app).render();
        this.renderTabs({title: 'Films', subtitle: 'Original content by Island',
            log: true});
        this.stop();
      }, this));
    },

    about: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'About', template: aboutTemp}).render();
        this.renderTabs({title: 'About', subtitle: 'What\'s going on here?',
            log: true});
        this.stop();
      }, this));
    },

    privacy: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Privacy', template: privacyTemp}).render();
        this.renderTabs({title: 'Privacy Policy', subtitle: 'Last updated 7.27.2013',
            log: true});
        this.stop();
      }, this));
    },

    settings: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/settings', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Settings(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    admin: function () {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/admin', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Admin(this.app).render();
        this.renderTabs({tabs: [
            {title: 'Beta', active: true},
            {title: 'Something Else'}
            ]})
        this.stop();
      }, this));
    },

    reset: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Password reset'});
    },

    ascent: function (country, crag, type, ascent) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.renderTabs();
      var key = [country, crag, type, ascent].join('/');
      var query = {actions: this.getAscentEventActions()};
      this.render('/service/ascent/' + key, query, _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    crag: function (country, crag) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.renderTabs();
      var key = [country, crag].join('/');
      var query = {actions: this.getEventActions()};
      this.render('/service/crag/' + key, query, _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    session: function (key) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.renderTabs();
      this.render('/service/session/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Session({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    tick: function (key) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.renderTabs();
      this.render('/service/tick/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Tick({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    post: function (username, key) {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      var key = [username, key].join('/');
      this.renderTabs();
      this.render('/service/post/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Post({wrap: '.main'}, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    profile: function (username) {
      this.start();
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      var query = {actions: this.getEventActions()};
      this.render('/service/member/' + username, query,
          _.bind(function (err) {
        if (err) return;
        this.page = new Profile(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    signin: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Signin(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Log In', subtitle: 'Welcome back'});
    },

    signup: function () {
      this.start();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Signup(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign Up', subtitle: 'It\'s free'});
    },

    default: function () {
      this.renderTabs();
      $('.container').removeClass('wide').removeClass('landing');
      this.render(_.bind(function (err) {
        if (err) return;
        this.page = new Error(this.app).render({
          code: 404,
          message: 'Sorry, this page isn\'t available'
        });
        this.stop();
      }, this));
    }
  
  });
  
  return Router;

});
