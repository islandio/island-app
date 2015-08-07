/*
 * Page view for import insert.
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
  'views/lists/watchees'
], function ($, _, Backbone, mps, rpc, rest, util, Card, Spin, Tick, template,
    Watchees) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.ticks = [];

      this.name = options.name;
      this.target = options.target;

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | ' + this.target + ' Import');
      this.model = new Card(this.app.profile.content.page, {
        gradeConverter: this.app.gradeConverter,
        prefs: this.app.profile.member ? this.app.profile.member.prefs: this.app.prefs
      });
      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');

      // Render each tick as a view.
      var ticks = this.$('.tick');
      var win = $(window);
      _.each(ticks, _.bind(function (el, i) {
        _.defer(_.bind(function () {
          el = $(el);
          var data = _.find(this.model.get('ticks')[el.data('type')], function (t) {
            return t.id === el.attr('id');
          });
          var tick = new Tick({
            parentView: this,
            el: el,
            model: data,
            mapless: true,
            medialess: true,
            commentless: true,
            inlineWeather: false,
            showCragName: true,
            inlineDate: true,
            shareless: true,
            inlineRemove: true,
            dateless: true
          }, this.app);
          tick.render();
          this.ticks.push(tick);

          win.trigger('resize');

        }, this));
      }, this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .new-session-button': 'submit',
      'click .info-remove': 'setTickRemove',
      'click .import-include-all': 'includeAll',
      'click .import-remove-all': 'removeAll'
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ticks-filter-input input');
      this.emptyTxt = this.$('.ticks-filter-input span');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ticks');
      this.routes = this.$('.r-ticks');
      this.button = this.$('.import-insert');
      this.allButtons = this.$('.button');

      // Init the load indicator.
      this.spin = new Spin(this.$('.button-spin'), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Handle type changes.
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

      if (this.model.get('ticks').b.length === 0) {
        this.$('.b-ticks .empty-feed').show();
      }

      if (this.model.get('ticks').r.length === 0) {
        this.$('.r-ticks .empty-feed').show();
      }

      if (this.model.get('ticks').b.length === 0 &&
          this.model.get('ticks').r.length === 0) {
        this.allButtons.addClass('disabled');
      }

      _.defer(_.bind(function () {
        this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
        this.routesFilter.click(_.bind(this.changeType, this, 'r'));
      }, this));

      // Handle filtering.
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      // Focus.
      if (!$('.header-search .search-display').is(':visible')) {
        this.filterBox.focus();
      }

      // Render lists.
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.sroutes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.sboulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

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
      this.crags.destroy();
      this.sroutes.destroy();
      this.sboulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    submit: function (e) {

      var filteredTicks = _.filter(this.ticks, function(tick) {
        return tick.model.get('remove') !== true;
      });

      if (filteredTicks.length === 0 || this.submitting) return;
      this.submitting = true;
      this.spin.start();
      this.allButtons.addClass('disabled').attr('disabled', true);
      this.button.addClass('spinning');

      // Add missing ascents
      var ascents = _.compact(_.map(filteredTicks, function (tick) {
        var t = tick.model.attributes;
        if (!t.ascent.id) {
          return {
            crag_id: t.crag.id,
            sector: t.ascentSector,
            name: t.ascent.name,
            type: t.type,
            grade: t.grade,
            silent: true // doesn't post to event feed
          };
        } else {
          return null;
        }
      }));
      var fn = ascents.length > 0 ? rest.post :
          function(arg1, arg2, cb) { cb(); };
      fn.call(rest, '/api/ascents/', ascents, _.bind(function (err, res) {
        if (err) {
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }, true]);
          return this.submitError();
        }

        // Gather up all ticks into 'sessions' with some basic manipulations
        var sessions = _.map(filteredTicks, function(tick) {
          var t = tick.model.attributes;
          t.index = 0;

          var payload = {
            crag_id: t.crag.id,
            date: t.date,
            silent: false
          };
          delete t.crag;

          var name = t.ascent.name;
          delete t.ascent;
          t.ascent = {name: name};

          delete t.remove;

          // some legacy stuff going on here
          var action = {ticks: [t]};
          var actions = [action];
          payload.actions = actions;
          return payload;
        });

        rest.post('/api/sessions/', sessions, _.bind(function (err, res) {
          if (err) {
            mps.publish('flash/new', [{
              err: err,
              level: 'error'
            }, true]);
            return this.submitError();
          }
          this.spin.stop();
          this.allButtons.removeClass('disabled').attr('disabled', false);
          this.button.removeClass('spinning');
          this.submitting = false;

          // Show success.
          var ticks = filteredTicks.length;
          mps.publish('flash/new', [{
            message: 'You successfully imported your ' + this.target +
                ' scorecard and added ' + ticks + ' new ascents.',
            level: 'alert',
            sticky: true
          }, true]);

          this.app.router.navigate('/', {trigger: true});

        }, this));
      }, this));
    },

    setTickRemove: function(e) {
      var $tickRemoveText = $(e.target)
      var $tickInner = $tickRemoveText.parentsUntil('.tick');

      var model = _.find(this.ticks, function(t) {
        return t.model.get('id') === $tickInner.parent().attr('id');
      }).model;

      if (model.get('remove')) {
        model.set('remove', false);
        $tickRemoveText.text('Remove');
        $tickInner.css({opacity: ''});
      } else {
        model.set('remove', true);
        $tickRemoveText.text('Include');
        $tickInner.css({opacity: 0.5});
      }
    },

    removeAll: function() {
      $('.tick-inner').css({opacity: 0.5});
      $('.info-remove').text('Include');
      _.each(this.ticks, function(tick) {
        tick.model.set('remove', true);
      });
    },

    includeAll: function() {
      $('.tick-inner').css({opacity: ''});
      $('.info-remove').text('Remove');
      _.each(this.ticks, function(tick) {
        tick.model.set('remove', false);
      });
    },

    submitError: function () {
      this.spin.stop();
      this.allButtons.removeClass('disabled').attr('disabled', false);
      this.button.removeClass('spinning');
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
