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
  'views/lists/choices'
], function ($, _, Backbone, mps, rest, util, Flashes, Choices) {
  return Backbone.View.extend({

    el: '.header',
    working: false,

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
      this.setup();
      return this;
    },

    setup: function () {

      // Save refs.
      this.panel = $('.panel');
      this.wrap = $('.container');

      this.delegateEvents();
      if (this.app.profile && this.app.profile.member) {
        this.subscriptions.push(mps.subscribe('notification/change',
            _.bind(this.checkBeacon, this)));
      }

      this.subscriptions.push(mps.subscribe('cart/update',
          _.bind(this.updateCart, this)));
      this.subscriptions.push(mps.subscribe('cart/empty',
          _.bind(this.updateCart, this)));
      this.updateCart();

      // Start block messages.
      if(!this.flashes) {
        this.flashes = new Flashes(this.app, {
          el: this.$('.block-messages > ul'),
          type: 'block'
        });
      }

      // Start search choices.
      if(!this.choices) {
        this.choices = new Choices(this.app, {
          reverse: true,
          el: '.header-search',
          collapse: true,
          placeholder: 'Search for members, ascents and crags...',
          route: true,
          types: ['members', 'ascents', 'crags'],
          log: true
        });
      }
    },

    events: {
      'click .signin-button': 'signin',
      'click .header-avatar': 'avatar',
      // 'click .header-add-crag-button': 'addCrag',
      // 'click .header-add-ascent-button': 'addAscent',
      'click .globe-button': 'togglePanel',
      'click .navigate': 'navigate',
      'click .header-tips': function () {
        mps.publish('modal/welcome/open', ['Tips', true]);
      }
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
        this.$('.note-count').text(unread.length).show();
      else
        this.$('.note-count').text('').hide();
    },

    updateCart: function () {
      var cart = store.get('cart');
      var count = 0;
      _.each(cart, function (i) {
        count += i;
      });

      if (count > 0) {
        this.$('.cart-count').text(' (' + count + ')');
      } else {
        this.$('.cart-count').text('');
      }
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

    highlight: function (href) {
      this.$('.header-links > li > a').removeClass('active');
      this.$('.header-links > li > a[href="' + href + '"]').addClass('active');
    },

    highlightSub: function (href) {
      this.$('.header-menu a').removeClass('active');
      this.$('.header-menu a[href="' + href + '"]').addClass('active');
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
