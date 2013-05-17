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

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    render: function () {

      // Kill listeners / subscriptions.
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

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
        
        // Shell subscriptions:
        this.subscriptions = [
          mps.subscribe('notification/change', _.bind(this.checkBeacon, this)),
        ];
      }
    },

    // Bind mouse events.
    events: {
      // 'click #logo': 'home',
      // 'click #login': 'login',
      // 'click #logout': 'logout',
      'click #globe': 'togglePanel'
    },

    // home: function (e) {
    //   e.preventDefault();

    //   // Route to home:
    //   this.app.router.navigate('/', {trigger: true});
    
    // },

    // login: function (e) {
    //   e.preventDefault();

    //   // Route to login:
    //   this.app.router.navigate('/login', {trigger: true});
    
    // },

    // logout: function (e) {
    //   e.preventDefault();

    //   // Logout (kill db session):
    //   rpc.execute('/service/person.logout', {}, {
    //     success: _.bind(function (data) {

    //       // Delete the app profile:
    //       this.app.update({});

    //       // Route to login:
    //       this.app.router.navigate('/login', {trigger: true});

    //     }, this),

    //     error: function (x) {

    //       // TODO: render 404.
    //       console.warn(x);
    //     }
    //   });
    // },

    togglePanel: function (e) {
      var panel = $('#panel');
      var wrap = $('#wrap');
      if (panel.hasClass('open')) {
        wrap.removeClass('panel-open');
        panel.removeClass('open');
        store.set('notesOpen', false);
      } else {
        wrap.addClass('panel-open');
        panel.addClass('open');
        store.set('notesOpen', true);
      }
      mps.publish('panel/click', [{open: store.get('notesOpen')}]);
    },

    checkBeacon: function () {
      var unread = $('#panel .unread');
      if (unread.length > 0)
        this.$('.mail-status').addClass('unread');
      else
        this.$('.mail-status').removeClass('unread');
    },

  });
});
