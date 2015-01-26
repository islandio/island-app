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
  'views/lists/flashes',
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
  'views/import.search',
  'views/import.insert',
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
  'text!../templates/tip.html',
  'views/session.new'
], function ($, _, Backbone, Spin, mps, rest, util, Error, Header, Tabs, Footer,
    Flashes, Signin, Signup, Forgot, Notifications, Map, Profile, Post, Session, Tick,
    Crag, Admin, ImportSearch, ImportInsert, Ascent, Settings, Reset, Films, Static,
    Crags, Dashboard, Splash, Ticks, aboutTemp, privacyTemp, tipTemp, NewSession) {

  /*
   * Determine if parent is iframe.
   */
  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  /*
   * Handle sizing.
   */
  function fitSides() {
    var win = $(window);
    var m = $('.main');
    var ls = $('.leftside');
    var rs = $('.rightside');
    var lh = ls.outerHeight();
    var rh = rs.outerHeight();
    if (win.width() < 1146) {
      m.height('100%');
    } else {
      if (rs.height() > ls.height()) {
        var pu = $('.profile-upper');
        if (pu.length > 0) {
          rh += pu.outerHeight();
        }
        m.height(rh);
      } else {
        m.height('100%');
      }
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

      // Determine if this is a blog page.
      var rx = new RegExp([window.location.host, 'blog'].join('/'), 'i');
      this.app.blog = rx.test(window.location.href);

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

      this.route('blog/:p', 'blog', this.blog);
      this.route('blog/category/:c', 'blog', this.blog);
      this.route('blog/page/:c', 'blog', this.blog);
      this.route('blog', 'blog', this.blog);

      this.route('reset', 'reset', this.reset);
      this.route('admin', 'admin', this.admin);
      this.route('import', 'import', this.import);
      this.route('import/:slug', 'import', this.import);
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

      // Render welcome modal.
      mps.subscribe('modal/welcome/open', _.bind(function (title, skipUpdate) {
        this.renderWelcome(title, skipUpdate);
      }, this));

      // Log new session.
      mps.subscribe('session/new', _.bind(function (opts) {
        this.modal = new NewSession(this.app, opts).render();
      }, this));

      // Fit on window resize.
      $(window).resize(_.debounce(fitSides, 100));
      $(window).resize(_.debounce(fitSides, 500));
      $(window).resize(_.debounce(fitSides, 1000));
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
        if (!this.app.blog) {
          this.header.highlight(window.location.pathname);
        } else {
          this.app.blog = false;
        }
        if (!this.map && this.showMap) {
          this.map = new Map(this.app).render();
        }
        if (!this.notifications && this.app.profile && this.app.profile.member) {
          this.notifications = new Notifications(this.app, {reverse: true});
        }
        if (!this.footer) {
          this.footer = new Footer(this.app).render();
        }
        if(!this.flashes) {
          this.flashes = new Flashes(this.app, {
            el: $('.popup-messages > ul'),
            type: 'popup'
          });
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
      cb = cb || function(){};

      // Check if a profile exists already.
      var query = this.app.profile
          && this.app.profile.notes ? {n: 0}: {};
      _.extend(query, data);

      // Get a profile, if needed.
      rest.get(service, query, _.bind(function (err, pro) {
        var mem = (pro || err).member;
        if (err) {
          this.clearContainer();
          this.stop();
          this.page = new Error(this.app).render(err);
        }
        if (secure && !mem) {
          return this.navigate('/', true);
        }
        if (mem) {
          this.showMap = true;
        }

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);

        // Handle welcome modal.
        if (this.app.profile && this.app.profile.member
            && !this.app.profile.member.welcomed) {
          this.app.profile.member.welcomed = true;
          this.renderWelcome('Thanks for signing up for our private beta!');
        }
      }, this));
    },

    clearContainer: function () {
      $('.container').removeClass('narrow').removeClass('wide')
          .removeClass('landing').removeClass('blog');
    },

    renderWelcome: function (title, skipUpdate) {
      var mem = this.app.profile.member;
      if (!mem) {
        return;
      }
      $.fancybox(_.template(tipTemp)({
        message: '<span style="font-size:14px;"><strong>The Island welcomes you.</strong>'
            + ' Here are a few tips to get you started:</span>'
            + '<br /><br />'
            + '<ol>'
            + '<li>Use the search bar at the top of the page to find some crags and friends you want to watch or follow. You can find boulder problems and routes to watch on crag pages.</li>'
            + '<li>Your activity feed shows logged climbing activity and posts from the crags and climbs you watch and the people you follow.</li>'
            + '<li>Check out your sidebar for some suggested athletes to follow.</li>'
            + '<li>The big green "Log" button is your starting place for tracking your rock climbing. The pencil icons are a shortcut for starting a log and are often next to crag and climb names - use \'em! </li>'
            + '<li>In addition to logging a completed climb as an "ascent", log attempts as "work" - remember all your efforts!</li>'
            + '<li>Don\'t want to broadcast your efforts to the entire world? Check out the privacy options in your profile <a class="alt" href="/settings" target="blank">settings</a>.</li>'
            + '<li>Send us your questions, bug reports, and problems with the blue tab below or at <a class="alt" href="mailto:support@island.io">support@island.io</a>.</li>'
            + '</ol>'
            + '<span style="font-size:14px;"><strong>Do you use 8a.nu?</strong>'
            + ' You can <a href="/import" target="blank" class="alt">import your 8a scorecard</a> from your profile <a class="alt" href="/settings" target="blank">settings</a>.</span>'
        , title: title
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      $('#tip_close').click(function (e) {
        $.fancybox.close();
        if (!skipUpdate) {
          rest.put('/api/members/' + mem.username + '/welcome', {},
              function (err, data) {
            if (err) {
              return console.log(err);
            }
          });
        }
      });
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
      if (!$('footer').hasClass('nohide')) {
        $('footer').hide();
      }
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
        fitSides();
        _.delay(fitSides, 100);
        _.delay(fitSides, 500);
        _.delay(fitSides, 1000);
      }, this));
    },

    refresh: function () {
      var frag = Backbone.history.fragment;
      Backbone.history.fragment = null;
      window.location.href = '/' + frag;
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
      $('.container').removeClass('narrow').removeClass('blog')
          .addClass('landing');
      this.renderTabs();
      // if (!this.tabs || !this.tabs.params.tabs || !this.tabs.params.tabs[1]
      //     || (_.str.strRightBack(this.tabs.params.tabs[1].href, '/')
      //     !== 'ascents')) {
      //   this.renderTabs();
      // }
      var query = {actions: this.getEventActions()};
      this.render('/service/dashboard', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member) {
          this.clearContainer();
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
      this.renderTabs();
      this.clearContainer();
      this.render('/service/ticks/' + username, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member
            && this.app.profile.member.username === username) {
          this.header.highlight('/');
          this.renderTabs({tabs: [
            {title: 'Activity', href: '/'},
            {title: 'My Ascents', href: '/' + username + '/ascents',
                active: true}
          ], log: true});          
        }
        _.defer(_.bind(function () {
          this.page = new Ticks(this.app).render();
          if (!this.app.profile.member
              || this.app.profile.member.username !== username) {
            this.renderTabs({html: this.page.title});
          }
        }, this));
        this.stop();
      }, this));
    },

    crags: function (country) {
      this.start();
      this.renderTabs();
      this.clearContainer();
      var query = {};
      if (country) query.country = country;
      var q = util.getParameterByName('q');
      if (q) query.query = q;
      this.render('/service/crags', query, _.bind(function (err) {
        if (err) return;
        this.page = new Crags(this.app).render();
        this.renderTabs({title: 'Rock climbing crags on Earth', log: true});
        this.stop();
      }, this));
    },

    films: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/films', _.bind(function (err) {
        if (err) return;
        this.page = new Films(this.app).render();
        this.renderTabs({title: 'Original films by The Island', log: true});
        this.stop();
      }, this));
    },

    about: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'About', template: aboutTemp}).render();
        this.renderTabs({title: 'What\'s going on here?', log: true});
        this.stop();
      }, this));
    },

    privacy: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app,
            {title: 'Privacy', template: privacyTemp}).render();
        this.renderTabs({title: 'The Island\'s Privacy Policy',
            log: true});
        this.stop();
      }, this));
    },

    settings: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
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
      this.clearContainer();
      this.render('/service/admin', {}, true, _.bind(function (err) {
        if (err) return;
        this.page = new Admin(this.app).render();
        this.renderTabs({tabs: [{title: 'Beta', active: true}]});
        this.stop();
      }, this));
    },

    import: function (slug) {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/import/' + slug, _.bind(function (err) {
        if (err) return;
        if (slug) {
          this.page = new ImportInsert(this.app, {slug: slug}).render();
        } else {
          this.page = new ImportSearch(this.app).render();
        }
        this.renderTabs({title: 'Import your 8a.nu Scorecard', log: true});
        this.stop();
      }, this));
    },

    reset: function () {
      this.start();
      this.clearContainer();
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Reset(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Password reset'});
    },

    ascent: function (country, crag, type, ascent) {
      this.start();
      this.clearContainer();
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
      this.clearContainer();
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
      this.clearContainer();
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
      this.clearContainer();
      this.renderTabs();
      this.render('/service/tick/' + key, _.bind(function (err) {
        if (err) return;
        this.page = new Tick({
          wrap: '.main',
          inlineTime: true,
          inlineWeather: true
        }, this.app).render(true);
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    post: function (username, key) {
      this.start();
      this.clearContainer();
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
      this.clearContainer();
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
      this.clearContainer();
      this.render(_.bind(function (err) {
        if (err) return;
        $('.container').addClass('narrow');
        this.page = new Signin(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign in to The Island'});
    },

    signup: function () {
      this.start();
      this.clearContainer();
      this.render(_.bind(function (err) {
        if (err) return;
        $('.container').addClass('narrow');
        this.page = new Signup(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign up for The Island'});
    },

    blog: function (slug) {
      if (this.app.profile) {
        return this.refresh();
      }
      this.start();
      this.render('/service/static', _.bind(function (err) {
        if (err) return;
        this.page = new Static(this.app).render();
        this.stop();
      }, this));
    },

    default: function () {
      this.renderTabs();
      this.clearContainer();
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
