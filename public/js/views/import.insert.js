/*
 * Page view for crags.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'rest',
  'util',
  'models/card',
  'Spin',
  'views/rows/tick',
  'text!../../templates/import.insert.html',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, rpc, rest, util, Card, Spin, Tick, template,
    Followers, Followees, Watchees) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.ticks = [];

      var name = options.slug.split('-');
      name.pop();
      this.name = name.join(' ');

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | Import');

      this.model = new Card(this.app.profile.content.page);

      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .button': 'submit',
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ticks-filter-input input');
      this.emptyTxt = this.$('.ticks-filter-input span');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ticks');
      this.routes = this.$('.r-ticks');

      // Init the load indicator.
      this.spin = new Spin(this.$('.button-spin'));

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

      // Handle filtering.
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      // Focus.
      if (!$('.header-search .search-display').is(':visible')) {
        this.filterBox.focus();
      }

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
          commentless: true,
          inlineWeather: false,
          showCragName: true,
          inlineDate: true
        }, this.app).render());
      }, this));

      return this;

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

    submit: function (e) {
      if (this.ticks.length === 0 || this.submitting) return;
      this.submitting = true;
      this.spin.start();

      // Add missing ascents
      var ascents = _.compact(_.map(this.ticks, function (tick) {
        var t = tick.model.attributes;
        if (!t.ascent.id) {
          return {
            crag_id: t.crag.id,
            sector: t.ascentSector,
            name: t.ascent.name,
            type: t.type,
            grades: [t.grade],
            noPublish: true
          };
        } else {
          return null;
        }
      }));
      var fn = ascents.length > 0 ? rest.post :
          function(arg1, arg2, cb) { cb() };
      fn.call(rest, '/api/ascents/', ascents, _.bind(function (err, res) {
        if (err) return this.submitError();

        var sessions = _.map(this.ticks, function(tick) {
          var t = tick.model.attributes;
          t.index = 0;

          var payload = {
            crag_id: t.crag.id,
            date: t.date
          };
          delete t.crag;

          var name = t.ascent.name;
          delete t.ascent;
          t.ascent = {name: name};

          // some legacy stuff going on here
          var action = {ticks: [t]};
          var actions = [action];
          payload.actions = actions;
          return payload;
        });
        rest.post('/api/sessions/', sessions, _.bind(function (err, res) {
          if (err) return this.submitError();
          this.spin.stop();
          this.submitting = false;

          // Show success.
          var ticks = this.ticks.length;
          mps.publish('flash/new', [{
            message: 'You successfully imported your 8a scorecard and added '
                + ticks + ' new ticks',
            level: 'alert'
          }, true]);

          this.app.router.navigate('/', {trigger: true});

        }, this));
      }, this));
    },

    submitError: function () {
      this.spin.stop();
      this.submitting = false;
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
    }


  });
});
