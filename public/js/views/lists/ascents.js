/*
 * Ascents view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'views/session.new',
  'text!../../../templates/ascents.html',
], function ($, _, Backbone, mps, rest, util, NewSession, template) {
  return Backbone.View.extend({

    el: '.crag-ascents',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.subscriptions = [];
      this.options = options || {};
      this.on('rendered', this.setup, this);
      this.grades = {
        'r': [],
        'b': []
      };
    },

    events: {
      'click .navigate': 'navigate',
      'click .list-button': 'log'
    },

    render: function (options) {

      function _render() {

        // Save ref to flattened lists for filtering and convert the grade
        this.flattened = {};
        _.each(this.data.ascents, _.bind(function (ascents, t) {
          this.flattened[t] = _.flatten(ascents);

          // convert grades
          var a = {};
          var self = this;
          _.each(ascents, function (ascent, grade) { 
            var key = self.app.gradeConverter[t].grades(grade, self.data.country);
            if (!a[key]) a[key] = [];
            a[key] = a[key].concat(ascent);
            delete ascents[grade];
          });

          _.each(a, function (_a, grade) {
            ascents[grade] = _a;
          });

          // sort grades
          this.grades[t] = _.keys(a).sort(function(a, b) {
            return self.app.gradeConverter[t].compare(b, a, self.data.country);
          });

        }, this));

        // Render template.
        this.$el.html(this.template.call(this));

        this.trigger('rendered');
      }

      // Clear.
      this.empty();
      delete this.data;

      // Fetch or use options data.
      if (options.cragId) {
        this.app.router.start();
        rest.post('/api/ascents/list/' + options.cragId, {},
            _.bind(function (err, data) {
          this.app.router.stop();

          if (err) {

            // Set the error display.
            mps.publish('flash/new', [{
              err: err,
              level: 'error'
            }, true]);
            return;
          }

          // Render sidebar.
          this.data = data;
          _render.call(this);
        }, this));
      } else if (options.data) {
        this.data = options.data;
        _render.call(this);
      }

      return this;
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ascents-filter-input input');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ascents');
      this.routes = this.$('.r-ascents');

      // Handle type changes.
      this.data.ascents.bcnt = this.data.ascents.bcnt || 0;
      this.data.ascents.rcnt = this.data.ascents.rcnt || 0;
      if (this.data.ascents.bcnt > this.data.ascents.rcnt) {
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
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    checkCurrentCount: function () {
      var ticks = this.flattened[this.currentType] || [];
      if (ticks.length === 0) {
        this.filterBox.hide();
        this.$('.' + this.currentType + '-ascents .empty-feed').show()
            .css('display', 'block');
      } else {
        this.filterBox.show();
        this.$('.' + this.currentType + '-ascents .empty-feed').hide();
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
      this.$('.' + this.currentType + '-ascents').show();
      this.checkCurrentCount();
      this.filterBox.keyup();
    },

    filter: function (e) {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      $('.' + ct + '-ascents .no-results').hide();
      if (txt === '') {
        $('.' + ct + '-ascents .list li').show();
        $('.' + ct + '-ascents .list-group-heading').show();
        return false;
      }
      $('.' + ct + '-ascents .list li').hide();
      $('.' + ct + '-ascents .list-group-heading').hide();
      var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      var y = false;
      _.each(this.flattened[ct], function (a) {
        if (rx.test(a.name)) {
          y = true;
          var d = $('.' + ct + '-ascents .list li[id="' + a.id + '"]');
          d.show();
          $('.list-group-heading', d.parent()).show();
        }
      });
      if (!y) {
        $('.list-wrap .no-results').show();
      }
      return false;
    },

    log: function (e) {
      e.preventDefault();
      var aid = $(e.target).closest('li').attr('id');
      var cid = $(e.target).closest('li').data('cid');
      new NewSession(this.app, {crag_id: cid, ascent_id: aid}).render();
    }

  });
});
