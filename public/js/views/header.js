/*
 * Header view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'views/lists/flashes',
  'views/lists/choices',
  'text!../../templates/box.html'
], function ($, _, Backbone, mps, rest, util, Flashes, Choices, box) {
  return Backbone.View.extend({

    el: '.header',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
    },

    render: function (login) {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();

      if (login && this.app.profile.member) {
        this.$('.signin-button').remove();
        $(_.template(box).call(this)).appendTo(this.$('.header-inner'));

        // Open notification panel.
        if (store.get('notesOpen')) {
          var p = document.getElementById('panel');
          var w = document.getElementById('wrap');
          p.className = p.className + ' open';
          w.className = w.className + ' panel-open';
        }
      }

      this.setup();
      return this;
    },

    setup: function () {

      // Save refs.
      this.panel = $('.panel');
      this.wrap = $('.wrap');

      this.delegateEvents();
      if (this.app.profile && this.app.profile.member) {
        this.subscriptions.push(mps.subscribe('notification/change',
            _.bind(this.checkBeacon, this)));
      }

      // Start block messages.
      if(!this.flashes) {
        this.flashes = new Flashes(this.app);
      }

      // Start search choices.
      if(!this.choices) {
        this.choices = new Choices(this.app, {
          reverse: true, 
          el: '.header-search',
          collapse: true,
          placeholder: 'Search for something...',
          route: true,
          types: ['members', 'posts', 'crags']
        });
      }
    },

    events: {
      'click .signin-button': 'signin',
      'click .header-avatar': 'avatar',
      'click .header-add-crag-button': 'addCrag',
      'click .header-add-ascent-button': 'addAscent',
      'click .globe-button': 'togglePanel',
      'click .navigate': 'navigate'
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
      var unread = $('.panel .unread');
      if (unread.length > 0)
        this.$('.count').text(unread.length).show();
      else
        this.$('.count').text('').hide();
    },

    signin: function (e) {
      e.preventDefault();
      mps.publish('member/signin/open');
    },

    avatar: function (e) {
      e.preventDefault();
      this.app.router.navigate('/' + this.app.profile.member.username,
          {trigger: true});
    },

    addCrag: function (e) {
      e.preventDefault();
      mps.publish('map/add');
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
