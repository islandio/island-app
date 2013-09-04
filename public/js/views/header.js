/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc',
  'util',
  'views/lists/flashes',
  'views/lists/choices',
], function ($, _, Backbone, Modernizr, mps, rpc, util, Flashes, Choices) {
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

      // Save refs.
      this.panel = $('#panel');
      this.wrap = $('#wrap');

      // Shell event.
      this.delegateEvents();

      // Shell listeners / subscriptions.
      // Do this here intead of init ... re-renders often.
      if (this.app.profile && this.app.profile.member) {
        
        // Shell subscriptions.
        this.subscriptions.push(mps.subscribe('notification/change',
            _.bind(this.checkBeacon, this)));
        this.subscriptions.push(mps.subscribe('member/delete',
            _.bind(this.logout, this)));
      }

      // Start block messages.
      if(!this.flashes)
        this.flashes = new Flashes(this.app);

      // Start search choices.
      if(!this.choices)
        this.choices = new Choices(this.app, {reverse: true});
    },

    // Bind mouse events.
    events: {
      'click #logo': 'home',
      'click #team': 'team',
      'click #films': 'films',
      'click #about': 'about',
      'click #contact': 'contact',
      'click #signin': 'signin',
      'click #header_avatar': 'avatar',
      'click #settings': 'settings',
      'click #globe': 'togglePanel'
    },

    togglePanel: function (e) {
      if (this.panel.hasClass('open')) {
        this.wrap.removeClass('panel-open');
        this.panel.removeClass('open');
        store.set('notesOpen', false);
      } else {
        this.wrap.addClass('panel-open');
        this.panel.addClass('open');
        store.set('notesOpen', true);
      }
      _.delay(function () {
        $(window).resize();
      }, 1000);
    },

    checkBeacon: function () {
      var unread = $('#panel .unread');
      if (unread.length > 0)
        this.$('.count').text(unread.length).show();
      else
        this.$('.count').text('').hide();
    },

    logout: function () {

      // Swap member header content.
      this.$('div.member-box').remove();
      $('<a id="signin" class="button">Sign in</a>')
          .appendTo(this.$('#header-inner'));
      
      // Close the panel.
      this.wrap.removeClass('panel-open');
      this.panel.removeClass('open');
      _.delay(function () {
        $(window).resize();
      }, 1000);
    },

    home: function (e) {
      e.preventDefault();

      // Route to home.
      this.app.router.navigate('/', {trigger: true});
    },

    team: function (e) {
      e.preventDefault();

      // Route to about.
      this.app.router.navigate('/team', {trigger: true});
    },

    films: function (e) {
      e.preventDefault();

      // Route to films.
      this.app.router.navigate('/films', {trigger: true});
    },

    about: function (e) {
      e.preventDefault();

      // Route to about.
      this.app.router.navigate('/about', {trigger: true});
    },

    contact: function (e) {
      e.preventDefault();

      // Route to about.
      this.app.router.navigate('/contact', {trigger: true});
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('member/signin/open');
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

  });
});
