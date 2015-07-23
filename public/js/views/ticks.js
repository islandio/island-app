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
  'views/chart.scatter',
  'views/lists/events',
], function ($, _, Backbone, mps, util, Card, Tick, template,
    title, ScatterChart, Events) {
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
        prefs: this.app.profile.member
            ? this.app.profile.member.prefs: this.app.prefs
      });
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.title = _.template(title).call(this);

      var buttonNames = [ 'Boulders', 'Routes' ];
      var graphTitle = '';
      if (this.model.get('ticks').b.length > this.model.get('ticks').r.length) {
        this.currentType = 'b';
        graphTitle = 'Bouldering Timeline';
      } else {
        this.currentType = 'r';
        graphTitle = 'Route Timeline';
        buttonNames.reverse();
      }

      this.scatterChart = new ScatterChart(this.app, {
        $el: this.$('.scatter-chart'),
        parentView: this,
        buttons: buttonNames
      }).render();

      this.scatterChart.setTitle(graphTitle);

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      this.on('svgButton', this.svgButton, this);

      this.feed = new Events(this.app, {
        parentView: this,
        reverse: true,
        input: false,
        filters: false
      });

      this.scatterChart.update(this.model.get('ticks')[this.currentType],
          this.currentType, {immediate: true});

      $(window).resize(_.debounce(_.bind(
          this.scatterChart.resize, this.scatterChart), 20));

      return this;
    },

    svgButton: function(d) {
      if (d === 'Boulders' && this.currentType === 'r') {
        this.currentType = 'b';
        this.scatterChart.setTitle('Bouldering Timeline');
      }
      else if (d === 'Routes' && this.currentType === 'b') {
        this.currentType = 'r';
        this.scatterChart.setTitle('Route Timeline');
      }
      else {
        return;
      }

      this.scatterChart.update(this.model.get('ticks')[this.currentType],
          this.currentType, {immediate: false});

    },

    collect: function (data) {
      if (data.author.id === this.model.get('author').id && data.sent) {
        var t = this.model.get('ticks');
        t[data.type].push(data);
        if (this.currentType === data.type) {
          this.scatterChart.update(this.model.get('ticks')[this.currentType],
              this.currentType, {immediate: false});
        }
      }
    },

    _remove: function (data) {
      var ticks = this.model.get('ticks');
      var dataType;
      _.each(ticks, function(v, k) {
        ticks[k] = _.reject(v, function(t) {
          if (data.id === t.id) {
            dataType = t.type;
            return true;
          }
          return false;
        });
      });
      if (this.currentType === dataType) {
        this.scatterChart.update(this.model.get('ticks')[this.currentType],
            this.currentType, {immediate: false});
      }
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      $(window).off('resize');
      this.app.rpc.socket.removeListener('tick.new', this.collect);
      this.app.rpc.socket.removeListener('tick.removed', this._remove);
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.scatterChart.destroy();
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
    }

  });
});
