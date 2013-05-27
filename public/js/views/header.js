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
      this.subscriptions = [

      ];
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
      'click #globe': 'togglePanel'
    },

    home: function (e) {
      e.preventDefault();

      // Route to home:
      this.app.router.navigate('/', {trigger: true});
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
