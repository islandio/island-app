/*
 * Session View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/session',
  'views/rows/tick',
  'text!../../../templates/rows/session.html',
  'text!../../../templates/rows/session.activity.html',
  'text!../../../templates/session.title.html',
  'text!../../../templates/confirm.html',
  'views/minimap'
], function ($, _, Backbone, mps, rest, util, Model, Tick, template,
      activityTemp, title, confirm, MiniMap) {
  return Backbone.View.extend({

    ticks: [],

    attributes: function () {
      var attrs = {class: 'session'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);
      this.activityTemp = _.template(activityTemp);
      this.subscriptions = [];

      // // Socket subscriptions
      // this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      // this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.$el.html(this.template.call(this));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
        this.$el.attr('id', this.model.id);
      }

      // Render each tick as a view.
      _.each(this.$('.tick'), _.bind(function (el) {
        el = $(el);
        var action = _.find(this.model.get('actions'), function (a) {
          return a.id === el.data('aid');
        });
        var data = _.find(action.ticks, function (t) {
          return t.id === el.attr('id');
        });
        this.ticks.push(new Tick({parentView: this, el: el, model: data},
            this.app).render());
      }, this));

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.formatName());

        // Render title.
        this.title = _.template(title).call(this);
      }

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Set map view.
      if (!this.parentView) {
        mps.publish('map/fly', [this.model.get('crag').location]);
      }

      // Render map.
      this.map = new MiniMap(this.app, {
        el: this.$('.mini-map'),
        location: this.model.get('crag').location
      }).render();

      // Handle time.
      // this.timer = setInterval(_.bind(this.when, this), 5000);
      // this.when();
    },

    // Collect a tick.
    collect: function (data) {
      if (data.session_id === this.model.id) {
        var tick = this.renderTick(data);
        var activity = this.$('.session-activity[data-type="' + data.type + '"]');
        if (activity.length > 0) {
          $(tick).appendTo($('.session-ticks', activity));
        } else {
          data.action.ticks = [data];
          activity = this.renderActivity(data.action);
          $(activity).insertAfter(this.$('.session-activity').last());
        }
        var action = _.find(this.model.get('actions'), function (a) {
          return a.id === data.action.id;
        });
        if (!action) {
          this.model.get('actions').push(data.action);
        } else {
          action.ticks = _.reject(action.ticks, function (t) {
            return t.id === data.id;
          });
          action.ticks.push(data);
        }
      }
    },

    // Remove a tick.
    _remove: function (data) {
      var t = this.$('li#' + data.id);
      var a = t.closest('.session-activity');
      var list = $('.session-ticks', a);
      t.slideUp('fast', _.bind(function () {
        t.remove();
        if (list.children().length === 0) {
          a.remove();
        }
      }, this));
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.ticks, function (t) {
        t.destroy();
      });
      this.map.destroy();
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    when: function () {
      if (!this.model.get('updated')) return;
      if (!this.time) {
        this.time = $('#time_' + this.model.id);
      }
      this.time.text(util.getRelativeTime(this.model.get('updated')));
    },

    renderActivity: function (a) {
      return this.activityTemp.call(this, {a: a});
    }

  });
});
