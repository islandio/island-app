/*
 * Page view for user ticks.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/card',
  'text!../../templates/ticks.html',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, util, Card, template,
    Followers, Followees, Watchees) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Card(this.app.profile.content.page);

      this.title();

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ticks-filter-input input');
      this.allFilter = this.$('.all-filter').parent();
      this.sentFilter = this.$('.sent-filter').parent();

      this.allFilter.click(_.bind(this.changeType, this, 'all'));
      this.sentFilter.click(_.bind(this.changeType, this, 'sent'));

      // // Disable types if nothing to show.
      // if (this.model.get('bcnt') === 0) {
      //   this.bouldersFilter.addClass('disabled');
      // }
      // if (this.model.get('rcnt') === 0) {
      //   this.routesFilter.addClass('disabled');
      // }

      // Handle filtering.
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      // Focus.
      if (!$('.header-search .search-display').is(':visible')) {
        this.filterBox.focus();
      }

      // Render lists.
      this.followers = new Followers(this.app, {parentView: this, reverse: true});
      this.followees = new Followees(this.app, {parentView: this, reverse: true});
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.routes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.boulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.followers.destroy();
      this.followees.destroy();
      this.crags.destroy();
      this.routes.destroy();
      this.boulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    title: function () {
      this.app.title('Island | ' + this.app.profile.member.displayName
          + ' - Ticks');
    },

    changeType: function (type, e) {

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active') || chosen.hasClass('disabled')) {
        return;
      }
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Set new type.
      // this.currentType = type;
      // this.$('.list-wrap').hide();
      // this.$('.' + this.currentType + '-ascents').show();
      // this.filterBox.keyup();
    },

    filter: function (e) {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      // $('.' + ct + '-ascents .no-results').hide();
      // if (txt === '') {
      //   $('.' + ct + '-ascents .list a').show();
      //   $('.' + ct + '-ascents .list-group-heading').show();
      //   return false;
      // }
      // $('.' + ct + '-ascents .list a').hide();
      // $('.' + ct + '-ascents .list-group-heading').hide();
      // var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      // var y = false;
      // _.each(this.flattened[ct], function (a) {
      //   if (rx.test(a.name)) {
      //     y = true;
      //     var d = $('.' + ct + '-ascents .list a[id="' + a.id + '"]');
      //     d.show();
      //     $('.list-group-heading', d.parent()).show();
      //   }
      // });
      // if (!y) {
      //   $('.list-wrap .no-results').show();
      // }
      return false;
    }

  });
});
