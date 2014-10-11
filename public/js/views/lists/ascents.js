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
], function ($, _, Backbone, mps, rest, util, Session, template) {
  return Backbone.View.extend({

    el: '.rightside',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.subscriptions = [];
      this.options = options || {};
      this.on('rendered', this.setup, this);
    },

    events: {
      'click .navigate': 'navigate',
      'click .list-button': 'log'
    },

    render: function (options) {
      this.app.router.start();

      function _render() {

        // Save ref to flattened lists for filtering.
        this.flattened = {};
        _.each(this.data.ascents, _.bind(function (ascents, t) {
          this.flattened[t] = _.flatten(ascents);
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
        rest.post('/api/ascents/list/' + options.cragId, {},
            _.bind(function (err, data) {

          // Stop spinner.
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
      if (this.data.bcnt > this.data.rcnt) {
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
      if (this.data.bcnt === 0) {
        this.bouldersFilter.addClass('disabled');
      }
      if (this.data.rcnt === 0) {
        this.routesFilter.addClass('disabled');
      }

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
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
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
      new Session(this.app, {crag_id: cid, ascent_id: aid}).render();
    }

  });
});