/*
 * Handle URL paths and changes.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps',
  'views/header',
  'views/footer',
  'views/profile',
  // 'views/login',
  'views/home'
], function ($, _, Backbone, rpc, mps, Header, Footer, Profile, Home) {

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
      this.route(':username', 'profile', _.bind(this.profile, this));
      // this.route(':username', 'person', _.bind(this.person, this, 'person'));
      // this.route(':username/c/:slug', 'campaign', _.bind(this.campaign, this, 'campaign'));
      // this.route(':username/c/:slug/:opp', 'fund', _.bind(this.fund, this, 'fund'));
      // this.route(':username/c/:slug/:opp?*qs', 'fund', _.bind(this.fund, this, 'fund'));
      // this.route(/^settings\/profile$/, 'profile', _.bind(this.profile, this, 'profile'));
      // this.route('login', 'login', _.bind(this.login, this, 'login'));
      this.route('', 'home', _.bind(this.home, this, 'home'));

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

    // login: function () {

    //   // Kill the notifications
    //   if (this.notifications)
    //     this.notifications.destroy();

    //   // Kill the page view if it exists.
    //   if (this.page)
    //     this.page.destroy();

    //   // Don't re-create the header.
    //   if (!this.header)
    //     this.header = new Header(this.app).render();
    //   else this.header.render();

    //   // Finally, create and render the page.
    //   this.page = new Login(this.app).render();

    //   // Don't re-render the header.
    //   if (!this.footer)
    //     this.footer = new Footer(this.app).render();

    // },

    home: function () {

      // Kill the page view if it exists.
      if (this.page)
        this.page.destroy();

      // Get the home profile.
      rpc.exec('/service/home.profile', _.bind(function (err, pro) {
        if (err) return console.error(err.stack);

        // Set the profile.
        this.app.update(pro);

        // Don't re-create the header.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();

        // Finally, create and render the page.
        this.page = new Home(this.app).render();

        // Don't re-render the header.
        if (!this.footer)
          this.footer = new Footer(this.app).render();

      }, this));

    },

    profile: function (username) {

      // Kill the page view if it exists.
      if (this.page)
        this.page.destroy();

      // Check if a profile exists already.
      if (this.app.profile && this.app.profile.get('content').page) {

        // Don't re-create the header.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();

        // Finally, create and render the page.
        this.page = new Member(this.app).render();

        return;
      }

      // Get the page profile.
      rpc.exec('/service/member.profile', {username: username},
          _.bind(function (err, pro) {
        if (err) return console.error(err.stack);

        // Set the profile.
        this.app.update(pro);

        // Don't re-create the header.
        if (!this.header)
          this.header = new Header(this.app).render();
        else this.header.render();

        // Finally, create and render the page.
        this.page = new Profile(this.app).render();

        // Don't re-render the header.
        if (!this.footer)
          this.footer = new Footer(this.app).render();

      }, this));

    },

    default: function (actions) {
      console.warn('No route:', actions);
    }
  
  });
  
  return Router;

});
