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
  'views/chart.bar',
  'views/chart.scatter',
  'views/chart.pie',
  'views/lists/events',
  'views/lists/watchees'
], function ($, _, Backbone, mps, util, Card, Tick, template,
    title, BarChart, ScatterChart, PieChart, Events, Watchees) {
  return Backbone.View.extend({

    el: '.main',
    ticks: [],

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];

      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('tick.new', this.collect);
      this.app.rpc.socket.on('tick.removed', this._remove);

      this.on('rendered', this.setup, this);
    },

    events: {
      'click .tick-inner': function (e) {
        var t = $(e.target);
        if (!t.is('a') && !t.is('time')) {
          var key = t.closest('.tick-inner').data('key');
          this.app.router.navigate('/efforts/' + key, {trigger: true});
        }
      },
      'click .navigate': 'navigate'
    },

    render: function () {
      this.model = new Card(this.app.profile.content.page, {
        gradeConverter: this.app.gradeConverter,
        prefs: this.app.profile.member ? this.app.profile.member.prefs: this.app.prefs
      });
      this.setTitle();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.title = _.template(title).call(this);

/*
      this.pieChart = new PieChart(this.app, {
        $el: this.$('.pie-chart')
      }).render();

      this.barChart = new BarChart(this.app, {
        $el: this.$('.bar-chart')
      }).render();
*/

      this.scatterChart = new ScatterChart(this.app, {
        $el: this.$('.scatter-chart')
      }).render();

      // Render each tick as a view.
      var ticks = this.$('.tick');
      var win = $(window);
      _.each(ticks, _.bind(function (el, i) {
        _.defer(_.bind(function () {
          el = $(el);
          var data = _.find(this.model.get('ticks')[el.data('type')],
              function (t) {
            return t.id === el.attr('id');
          });
          this.ticks.push(new Tick({
            parentView: this,
            el: el,
            model: data,
            compact: true,
            mapless: true,
            medialess: true,
            commentless: true,
            showCragName: true,
            inlineDate: true
          }, this.app).render());
          win.trigger('resize');
        }, this));
      }, this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {
      this.filterBox = this.$('.ticks-filter-input input');
      this.emptyTxt = this.$('.ticks-filter-input span');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ticks');
      this.routes = this.$('.r-ticks');

      if (this.model.get('ticks').b.length > this.model.get('ticks').r.length) {
        this.currentType = 'b';
        this.bouldersFilter.addClass('active');
        this.boulders.show();
        this.routes.hide();
      } else {
        this.currentType = 'r';
        this.routesFilter.addClass('active');
        this.routes.show();
        this.boulders.hide();
      }

      console.log(this.app.profile.content);
      /*
      this.feed = new Events(this.app, {
        parentView: this,
        reverse: true,
        input: true,
        filters: ['tick']
      });
      */

/*
      this.barChart.update(this.model.get('ticks')[this.currentType],
          this.currentType, {immediate: true} );
*/
      this.scatterChart.update(this.model.get('ticks')[this.currentType], 
          this.currentType, {immediate: true});

/*
      var countryData = _.pluck(this.model.get('ticks')[this.currentType],
          'crag');
      this.pieChart.update(countryData, 'country', {immediate: true});
*/

      _.defer(_.bind(function () {
        this.checkCurrentCount();
        this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
        this.routesFilter.click(_.bind(this.changeType, this, 'r'));
      }, this));

      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      if (!$('.header-search .search-display').is(':visible')) {
        this.filterBox.focus();
      }

      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.sroutes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.sboulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

      return this;
    },

    collect: function (data) {
      if (data.author.id === this.model.get('author').id && data.sent) {
        this._remove(data, true);
        var el = $('<li class="tick" id="' + data.id + '" data-type="' +
            data.type + '">');
        var grade;
        if (isNaN(Number(data.grade))) {
          grade = 'ungraded';
        } else {
          var prefs = this.model.prefs;
          var system = data.type === 'r' ? prefs.grades.route: prefs.grades.boulder;
          grade = this.app.gradeConverter[data.type].indexes(data.grade, null, system);
        }
        var heading = this.$('.' + data.type + '-ticks .session-ticks ' +
            '[data-grade="' + grade + '"]');
        el.insertAfter(heading);
        heading.parent().show();

        // create new tick view
        this.ticks.push(new Tick({
          parentView: this,
          el: el,
          model: data,
          mapless: true,
          medialess: true,
          commentless: true,
          showCragName: true,
          inlineDate: true
        }, this.app).render());
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

      if (noslide) {
        _done.call(this);
      } else {
        t.$el.slideUp('fast', _.bind(_done, this));
      }
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      this.app.rpc.socket.removeListener('tick.new', this.collect);
      this.app.rpc.socket.removeListener('tick.removed', this._remove);
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.ticks, function (t) {
        t.destroy();
      });
      this.scatterChart.destroy();
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
      this.app.title('The Island | ' + this.model.get('author').displayName +
          ' - Ascents');
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
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active') || chosen.hasClass('disabled')) {
        return;
      }
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      this.currentType = type;

/*
      this.barChart.update(this.model.get('ticks')[this.currentType], this.currentType);
*/
      this.scatterChart.update(this.model.get('ticks')[this.currentType], this.currentType);

/*
      var countryData = _.pluck(this.model.get('ticks')[this.currentType],
          'crag');
      this.pieChart.update(countryData, 'country', {immediate: true});
*/

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
