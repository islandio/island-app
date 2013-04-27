/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps',
  'text!../../templates/header.html',
  'views/build',
  'views/lists/flashes'
], function ($, _, Backbone, rpc, mps, template, Build, Flashes) {
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

      // UnderscoreJS templating:
      this.$el.html(_.template(template).call(this));

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
      if (this.app.profile && this.app.profile.get('person')) {
        
        // Shell events.
        this.app.profile.on('change:portfolio', _.bind(this.update, this));
        
        // Shell subscriptions:
        this.subscriptions = [
          mps.subscribe('notification/change', _.bind(this.beacon, this)),
          mps.subscribe('build/open', _.bind(this.build, this))
        ];

      }

      // Start block messages:
      if(!this.flashes)
        this.flashes = new Flashes();
      else this.flashes.destroy();
    },

    // Bind mouse events.
    events: {
      'click #logo': 'home',
      'click #login_signup': 'login',
      'click #logout': 'logout',
      'click #build-icon': 'build',
      'click #notification': 'ensurePermissions',
      'click .notification-indicator': 'onNotificationsClick'
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
    },

    build: function (campaign) {
      if (campaign.preventDefault) {
        var e =  campaign;
        e.preventDefault();
        new Build(this.app, { modal: true }).render();
      } else
        new Build(this.app, { modal: true, campaign: campaign }).render();
    },

    ensurePermissions: function() {
      if (window.webkitNotifications.checkPermission() == 0)
        alert('Hylo desktop notifications are enabled.')        
      else
        window.webkitNotifications.requestPermission();
    },

    onNotificationsClick: function() {
      var panel = $('#panel');
      var wrap = $('#wrap');
      if (panel.hasClass('open')) {
        wrap.removeClass('panel-open');
        panel.removeClass('open');
        store.set('isNotesOpen', false);
      } else {
        wrap.addClass('panel-open');
        panel.addClass('open');
        store.set('isNotesOpen', true);
      }
      mps.publish('notification-panel/click', [{open: store.get('isNotesOpen')}]);
    },

    beacon: function () {
      var unread = $('#panel .unread');
      if (unread.length > 0)
        this.$('.mail-status').addClass('unread');
      else
        this.$('.mail-status').removeClass('unread');
    },

    update: function () {

      // Update the Hylo count in UI.
      this.$('#portfolio_balance')
          .text(this.app.profile.get('portfolio').balance);
    }

  });
});
