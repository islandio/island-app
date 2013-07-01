/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'views/signin'
], function ($, _, Backbone, mps, rpc, Signin) {
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
      if (this.app.profile && this.app.profile.member) {
        
        // Shell subscriptions:
        this.subscriptions.push(mps.subscribe('notification/change',
            _.bind(this.checkBeacon, this)));
      }
    },

    // Bind mouse events.
    events: {
      'click #logo': 'home',
      'click #signin': 'signin',
      'click #header_avatar': 'avatar',
      'click #settings': 'settings',
      'click #globe': 'togglePanel'
    },

    home: function (e) {
      e.preventDefault();

      // Route to home.
      this.app.router.navigate('/', {trigger: true});
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      var signin = new Signin(this.app).render();
    },

    avatar: function (e) {
      e.preventDefault();

      // Route to profile.
      this.app.router.navigate('/' + this.app.profile.member.username,
          {trigger: true});
    },

    settings: function (e) {
      e.preventDefault();

      // Route to settings.
      this.app.router.navigate('/settings', {trigger: true});
    },

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
      _.delay(function () {
        $(window).resize();
      }, 500);
    },

    checkBeacon: function () {
      var unread = $('#panel .unread');
      if (unread.length > 0)
        this.$('.count').text(unread.length).show();
      else
        this.$('.count').text('').hide();
    },

  });
});
