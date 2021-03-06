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
  'views/store',
  'views/static',
  'views/crags',
  'views/activity',
  'views/splash',
  'views/ticks',
  'views/medias',
  'views/about',
  'text!../templates/about.html',
  'text!../templates/privacy.html',
  'text!../templates/tip.html',
  'views/session.new',
  'views/share'
], function ($, _, Backbone, Spin, mps, rest, util, Error, Header, Tabs, Footer,
    Flashes, Signin, Signup, Forgot, Notifications, Map, Profile, Post, Session,
    Tick, Crag, Admin, ImportSearch, ImportInsert, Ascent, Settings, Reset,
    Store, Static, Crags, Dashboard, Splash, Ticks, Medias, About, aboutTemp,
    privacyTemp, tipTemp, NewSession, Share
) {

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
        var pu = $('.profile-upper, .post-upper');
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
      if (window.location.hash !== '' ||
          window.location.href.indexOf('#') !== -1) {
        if (window.location.hash.length === 0 ||
            window.location.hash === '#_=_') {
          try {
            window.history.replaceState('', '', window.location.pathname +
                window.location.search);
          } catch (err) {}
        }
      }

      // Determine if this is a blog page.
      var rx = new RegExp([window.location.host, 'blog'].join('/'), 'i');
      this.app.blog = rx.test(window.location.href);

      // Init page spinner.
      this.spin = new Spin($('.page-spin'), {color: '#808080'});
      this.start(true, true);

      // Page routes.
      this.route(':un', 'profile', this.profile);
      this.route(':un/:k', 'post', this.post);
      this.route(':un/ascents', 'ticks', this.ticks);

      this.route('sessions/:k', 'session', this.session);
      this.route('efforts/:k', 'tick', this.tick);

      this.route('crags/:y', 'crag', this.crags);
      this.route('crags/:y/:g', 'crag', this.crag);
      this.route('crags/:y/:g/config', 'crag.config', this.cragConfig);
      this.route('crags/:y/:g/:t/:a', 'ascent', this.ascent);
      this.route('crags/:y/:g/:t/:a/config', 'ascent.config',
          this.ascentConfig);

      this.route('blog/:p', 'blog', this.blog);
      this.route('blog/category/:c', 'blog', this.blog);
      this.route('blog/page/:c', 'blog', this.blog);
      this.route('blog', 'blog', this.blog);

      this.route('media', 'media', this.media);

      this.route('reset', 'reset', this.reset);
      this.route('admin', 'admin', this.admin);
      this.route('import', 'import', this.import);
      this.route('import/:slug', 'import', this.import);
      this.route('settings', 'settings', this.settings);
      this.route('privacy', 'privacy', this.privacy);
      this.route('about', 'about', this.about);
      this.route('store', 'store', this.store);
      this.route('crags', 'crags', this.crags);
      this.route('signin', 'signin', this.signin);
      this.route('signup', 'signup', this.signup);
      this.route('following', 'following', this.following);
      this.route('', 'activity', this.activity);
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

      // Open share modal.
      mps.subscribe('modal/share/open', _.bind(function (opts) {
        this.modal = new Share(this.app, opts).render();
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
          this.header.highlightSub(window.location.pathname);
        } else {
          this.app.blog = false;
        }

        this.showMap = this.showMap & !isMobile()

        if (this.map) {
          if (this.showMap) {
            this.map.show();
          } else {
            this.map.hide();
          }
        } else if (!this.map && this.showMap) {
          this.map = new Map(this.app).render();
        }

        if (!this.notifications && this.app.profile &&
            this.app.profile.member) {
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

        cb(err);

        // Resize for map.
        window.dispatchEvent(new Event('resize'));
      }

      // Grab hash for comment.
      this.app.requestedCommentId = null;
      if (window.location.hash !== '' ||
          window.location.href.indexOf('#') !== -1) {
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
      var query = this.app.profile && this.app.profile.notes ? {n: 0}: {};
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
        this.showMap = true;

        // Set the profile.
        var login = this.app.update(pro || err);
        _render.call(this, err, login);

        // Handle welcome modal.
        if (this.app.profile && this.app.profile.member &&
            !this.app.profile.member.welcomed) {
          this.app.profile.member.welcomed = true;
          this.renderWelcome('Thanks for signing up!');
        }
      }, this));
    },

    clearContainer: function () {
      $('.container').removeClass('narrow').removeClass('wide')
          .removeClass('landing').removeClass('blog').removeClass('sign');
    },

    renderWelcome: function (title, skipUpdate) {
      var mem = this.app.profile.member;
      if (!mem) {
        return;
      }
      $.fancybox(_.template(tipTemp)({
        message: '<span style="font-size:14px;">' +
            '<ul>' +
            '<li><span class="item-pre">1</span> Use the search bar at the top of the page to find people, crags, and climbs.</li>' +
            '<li><span class="item-pre">2</span> Your feed shows activity from the crags and climbs you watch and the people you follow.</li>' +
            '<li><span class="item-pre">3</span> Check out your sidebar for some suggested athletes to follow.</li>' +
            '<li><span class="item-pre">4</span> The green "Log" buttons are your starting place for tracking your climbing.</li>' +
            '<li><span class="item-pre">5</span> In addition to logging a completed climb as an "ascent", log attempts as "work".</li>' +
            '<li><span class="item-pre">6</span> Don\'t want to broadcast to the entire world? Adjust the privacy options under your <a class="alt" href="/settings" target="blank">settings</a>.</li>' +
            '<li><span class="item-pre">7</span> Send us any questions or issues you have with the blue tab below or at <a class="alt" href="mailto:support@island.io">support@island.io</a>.</li>' +
            '</ul><br />' +
            '<span style="font-size:14px;"><strong>Do you use 8a.nu or 27crags?</strong>' +
            ' You can <a href="/import" target="blank" class="alt">import your scorecard</a> from your profile <a class="alt" href="/settings" target="blank">settings</a>.</span>',
        title: title
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

    start: function (skipQueue, skipClass) {
      if (!skipQueue) {
        this.loadingQueue.push(1);
      }
      if (this.loading) {
        return;
      }
      this.loading = true;
      if (!skipClass) {
        $(window).scrollTop(0);
        $('body').addClass('loading');
        if (!$('footer').hasClass('nohide')) {
          $('footer').hide();
        }
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

    activity: function () {
      this.start();
      $('.container').removeClass('narrow').removeClass('blog')
          .removeClass('sign');
      this.renderTabs();
      var query = {
        actions: this.getEventActions(),
        public: true
      };
      this.render('/service/activity', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member) {
          this.clearContainer();
          this.page = new Dashboard(this.app, {}).render();
          this.renderTabs({tabs: [
            {title: 'Activity', icon: 'icon-globe', href: '/', active: true},
            {title: 'Following', icon: 'icon-users', href: '/following'},
            {title: 'Recent Media', icon: 'icon-picture', href: '/media'},
            {title: 'My Ascents', icon: 'icon-award',
                href: '/' + this.app.profile.member.username + '/ascents'}
          ], log: true});
        } else {
          $('.container').addClass('wide').addClass('landing');
          this.page = new Splash(this.app).render();
        }
        this.stop();
      }, this));
    },

    following: function () {
      this.start();
      $('.container').removeClass('narrow').removeClass('blog')
          .removeClass('sign');
      this.renderTabs();
      var query = {actions: this.getEventActions()};
      this.render('/service/activity', query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member) {
          this.clearContainer();
          this.page = new Dashboard(this.app, {following: true}).render();
          this.renderTabs({tabs: [
            {title: 'Activity', icon: 'icon-globe', href: '/'},
            {title: 'Following', icon: 'icon-users', href: '/following',
                active: true},
            {title: 'Recent Media', icon: 'icon-picture', href: '/media'},
            {title: 'My Ascents', icon: 'icon-award',
                href: '/' + this.app.profile.member.username + '/ascents'}
          ], log: true});
        } else {
          $('.container').addClass('wide').addClass('landing');
          this.page = new Splash(this.app).render();
        }
        this.stop();
      }, this));
    },

    media: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/media', _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member) {
          this.header.highlight('/');
          this.renderTabs({tabs: [
            {title: 'Activity', icon: 'icon-globe', href: '/'},
            {title: 'Following', icon: 'icon-users', href: '/following'},
            {title: 'Recent Media', icon: 'icon-picture', href: '/media',
                active: true},
            {title: 'My Ascents', icon: 'icon-award',
                href: '/' + this.app.profile.member.username + '/ascents'}
          ], log: true});
        }
        _.defer(_.bind(function () {
          this.page = new Medias(this.app).render();
          if (!this.app.profile.member) {
            this.renderTabs({title: 'Recent Media'});
          }
        }, this));
        this.stop();
      }, this));
    },

    ticks: function (username) {
      this.start();
      this.renderTabs();
      this.clearContainer();
      var query = {actions: this.getEventActions()};
      this.render('/service/ticks/' + username, query, _.bind(function (err) {
        if (err) return;
        if (this.app.profile.member &&
            this.app.profile.member.username === username) {
          this.header.highlight('/');
          this.renderTabs({tabs: [
            {title: 'Activity', icon: 'icon-globe', href: '/'},
            {title: 'Following', icon: 'icon-users', href: '/following'},
            {title: 'Recent Media', icon: 'icon-picture', href: '/media'},
            {title: 'My Ascents', icon: 'icon-award',
                href: '/' + this.app.profile.member.username + '/ascents',
                active: true}
          ], log: true});
        }
        _.defer(_.bind(function () {
          this.page = new Ticks(this.app).render();
          if (!this.app.profile.member ||
              this.app.profile.member.username !== username) {
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

    store: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/store', _.bind(function (err) {
        if (err) return;
        this.page = new Store(this.app).render();
        this.renderTabs({html: this.page.title});
        this.stop();
      }, this));
    },

    about: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      this.render('/service/about', _.bind(function (err) {
        if (err) return;
        this.page = new About(this.app).render();
        this.renderTabs({title: 'About The Island'});
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
        this.renderTabs({title: 'Island\'s Privacy Policy',
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

    import: function () {
      this.start();
      this.renderTabs();
      this.clearContainer();
      var path, name = '';
      if (this.app.state && this.app.state.import) {
        var target = this.app.state.import.target;
        path = this.app.state.import.userId + '-' + target;
        name = this.app.state.import.name;
      }
      delete this.app.state.import;
      this.render('/service/import/' + path, _.bind(function (err) {
        if (err) return;
        if (path) {
          this.page = new ImportInsert(this.app,
              {name: name, target: target}).render();
        } else {
          this.navigate('/import');
          this.page = new ImportSearch(this.app).render();
        }
        this.renderTabs({title: 'Import your Scorecard', log: true});
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

    ascentConfig: function (country, crag, type, ascent) {
      this.start();
      this.clearContainer();
      this.renderTabs();
      var key = [country, crag, type, ascent].join('/');
      this.render('/service/ascent/' + key + '/config', _.bind(function (err) {
        if (err) return;
        this.page = new Ascent(this.app, {config: true}).render();
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

    cragConfig: function (country, crag) {
      this.start();
      this.clearContainer();
      this.renderTabs();
      var key = [country, crag].join('/');
      this.render('/service/crag/' + key + '/config', _.bind(function (err) {
        if (err) return;
        this.page = new Crag(this.app, {config: true}).render();
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
      key = [username, key].join('/');
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
      this.showMap = false;
      this.render(_.bind(function (err) {
        if (err) return;
        $('.container').addClass('narrow').addClass('sign');
        this.page = new Signin(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign In'});
    },

    signup: function () {
      this.start();
      this.clearContainer();
      this.showMap = false;
      this.render(_.bind(function (err) {
        if (err) return;
        $('.container').addClass('narrow').addClass('sign');
        this.page = new Signup(this.app).render();
        this.stop();
      }, this));
      this.renderTabs({title: 'Sign Up'});
    },

    blog: function (slug) {
      if (this.app.profile) {
        return this.refresh();
      }
      this.start(null, true);
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
