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
  'views/rows/tick',
  'text!../../templates/ticks.html',
  'text!../../templates/rows/session.tick.html',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, util, Card, Tick, template,
    tickTemp, Followers, Followees, Watchees) {
  return Backbone.View.extend({

    el: '.main',
    ticks: [],

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

      // this.app.rpc.socket.on('media.new', _.bind(this.collect, this));
      // this.app.rpc.socket.on('media.removed', _.bind(this._remove, this));

      this.on('rendered', this.setup, this);
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.model = new Card(this.app.profile.content.page);

      this.title();

      this.template = _.template(template);
      this.tickTemp = _.template(tickTemp);
      this.$el.html(this.template.call(this));

      // Render each tick as a view.
      _.each(this.$('.tick'), _.bind(function (el) {
        el = $(el);
        var data = _.find(this.model.get('ticks')[el.data('type')], function (t) {
          return t.id === el.attr('id');
        });
        this.ticks.push(new Tick({parentView: this, el: el, model: data},
            this.app).render());
      }, this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ticks-filter-input input');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ticks');
      this.routes = this.$('.r-ticks');

      // Handle type changes.
      if (this.model.get('ticks').b.length > this.model.get('ticks').r.length) {
        this.currentType = 'b';
        this.bouldersFilter.addClass('active');
        this.boulders.show();
      } else {
        this.currentType = 'r';
        this.routesFilter.addClass('active');
        this.routes.show();
      }
      this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
      this.routesFilter.click(_.bind(this.changeType, this, 'r'));

      // Disable types if nothing to show.
      if (this.model.get('ticks').b.length === 0) {
        this.bouldersFilter.addClass('disabled');
      }
      if (this.model.get('ticks').r.length === 0) {
        this.routesFilter.addClass('disabled');
      }

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
      this.sroutes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.sboulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

      return this;
    },

    // Collect a tick.
    collect: function (data) {
      if (data.author.id === this.app.profile.member.id && data.sent) {
        this._remove(data, true);
        var tick = this.renderTick(data);
        if (!data.grade) {
          data.grade = 'not graded by you';
        }
        var grade = this.app.grades[this.app.grades.length - data.grade - 1];
        var heading = this.$('.' + data.type + '-ticks .session-ticks '
            + '[data-grade="' + grade + '"]');
        $(tick).insertAfter(heading);
        heading.parent().show();
      }
    },

    // Remove a tick.
    _remove: function (data, noslide) {
      var t = this.$('li#' + data.id);
      if (t.length === 0) {
        return;
      }
      var list = t.closest('.session-ticks');

      function _done() {
        t.remove();
        if (list.children('li').length === 0) {
          list.hide();
        }
      }

      noslide ? t.slideUp('fast', _done): _done();
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.ticks, function (t) {
        t.destroy();
      });
      this.followers.destroy();
      this.followees.destroy();
      this.crags.destroy();
      this.sroutes.destroy();
      this.sboulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
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
      this.currentType = type;
      this.$('.list-wrap').hide();
      this.$('.' + this.currentType + '-ticks').show();
      this.filterBox.keyup();
    },

    filter: function (e) {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      $('.' + ct + '-ticks .no-results').hide();
      if (txt === '') {
        $('.' + ct + '-ticks .session-ticks li').show();
        $('.' + ct + '-ticks .tick-list-group-heading').show();
        return false;
      }
      $('.' + ct + '-ticks .session-ticks li').hide();
      $('.' + ct + '-ticks .tick-list-group-heading').hide();
      var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      var y = false;
      _.each(this.model.get('ticks')[ct], function (t) {
        if (rx.test(t.ascent.name)) {
          y = true;
          var d = $('.' + ct + '-ticks .session-ticks li[id="' + t.id + '"]');
          d.show();
          $('.tick-list-group-heading', d.parent()).show();
        }
      });
      if (!y) {
        $('.list-wrap .no-results').show();
      }
      return false;
    },

  });
});
