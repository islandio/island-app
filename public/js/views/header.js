/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc'
], function ($, _, Backbone, mps, rpc) {
  return Backbone.View.extend({

    el: '#header',

    initialize: function (app) {

      // Save app reference.
      this.app = app;

    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      // // UnderscoreJS templating:
      // this.$el.html(_.template(template).call(this));

      // Done rendering ... trigger setup.
      this.setup();

      return this;
    },

    // Misc. setup.    
    setup: function () {

      // Shell event.
      this.delegateEvents();

      // Shell listeners / subscriptions.
      // Do this here intead of init ... re-renders often.
      if (this.app.profile && this.app.profile.get('member')) {
        
        // Shell events.
        // this.app.profile.on('change:portfolio', _.bind(this.update, this));
        
        // Shell subscriptions:
        // this.subscriptions = [
        //   mps.subscribe('notification/change', _.bind(this.beacon, this)),
        //   mps.subscribe('build/open', _.bind(this.build, this))
        // ];

      }
    },

    // Bind mouse events.
    events: {
      'click #logo': 'home',
      'click #login_signup': 'login',
      'click #logout': 'logout',
    },

    home: function (e) {
      e.preventDefault();

      // Route to home:
      this.app.router.navigate('/', {trigger: true});
    
    },

    login: function (e) {
      e.preventDefault();

      // Route to login:
      this.app.router.navigate('/login', {trigger: true});
    
    },

    logout: function (e) {
      e.preventDefault();

      // Logout (kill db session):
      rpc.execute('/service/person.logout', {}, {
        success: _.bind(function (data) {

          // Delete the app profile:
          this.app.update({});

          // Route to login:
          this.app.router.navigate('/login', {trigger: true});

        }, this),

        error: function (x) {

          // TODO: render 404.
          console.warn(x);
        }
      });
    }

  });
});
