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
  'text!../../templates/ticks.title.html',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, util, Card, Tick, template,
    title, Followers, Followees, Watchees) {
  return Backbone.View.extend({

    el: '.main',
    ticks: [],

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

      this.on('rendered', this.setup, this);
    },

    events: {
      'click .tick-inner': function (e) {
        var t = $(e.target);
        if (t.is('a') || t.is('time')) {
          return false;
        }
        var key = t.closest('.tick-inner').data('key');
        this.app.router.navigate('/efforts/' + key, {trigger: true});
      },
      'click .navigate': 'navigate'
    },

    render: function () {
      this.model = new Card(this.app.profile.content.page);
      this.setTitle();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Render title.
      this.title = _.template(title).call(this);

      // Render each tick as a view.
      _.each(this.$('.tick'), _.bind(function (el) {
        el = $(el);
        var data = _.find(this.model.get('ticks')[el.data('type')], function (t) {
          return t.id === el.attr('id');
        });
        this.ticks.push(new Tick({
          parentView: this,
          el: el,
          model: data,
          mapless: true,
          medialess: true,
          commentless: true
        }, this.app).render());
      }, this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ticks-filter-input input');
      this.emptyTxt = this.$('.ticks-filter-input span');
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
      this.checkCurrentCount();
      this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
      this.routesFilter.click(_.bind(this.changeType, this, 'r'));

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
      if (data.author.id === this.model.get('author').id && data.sent) {
        this._remove(data, true);
        var el = $('<li class="tick" id="' + data.id + '" data-type="'
            + data.type + '">');
        var grade;
        if (isNaN(Number(data.grade))) {
          grade = 'not graded by you';
        } else {
          grade = this.app.grades[this.app.grades.length - data.grade - 1];
        }
        var heading = this.$('.' + data.type + '-ticks .session-ticks '
            + '[data-grade="' + grade + '"]');
        el.insertAfter(heading);
        heading.parent().show();

        // create new tick view
        this.ticks.push(new Tick({parentView: this, el: el, model: data},
            this.app).render());
        this.checkCurrentCount();
      }
    },

    _remove: function (data, noslide) {
      var t = _.find(this.ticks, function (t) {
        return t.model.id === data.id;
      });
      if (!t) {
        return;
      }

      this.ticks = _.reject(this.ticks, function (t) {
        return t.model.id === data.id;
      });
      var list = t.$el.closest('.session-ticks');

      function _done() {
        t.destroy();
        if (list.children('li').length === 0) {
          list.hide();
        }
        this.checkCurrentCount();
      }

      noslide ? _done.call(this): t.$el.slideUp('fast', _.bind(_done, this));
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

    setTitle: function () {
      this.app.title('The Island | ' + this.model.get('author').displayName
          + ' - Ascents');
    },

    checkCurrentCount: function () {
      var ticks = _.filter(this.ticks, _.bind(function (t) {
        return t.model.get('type') === this.currentType;
      }, this));
      if (ticks.length === 0) {
        this.filterBox.hide();
        this.$('.' + this.currentType + '-ticks .empty-feed').show()
            .css('display', 'block');
      } else {
        this.filterBox.show();
        this.$('.' + this.currentType + '-ticks .empty-feed').hide();
      }
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
      this.checkCurrentCount();
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
