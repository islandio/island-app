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

      // Socket subscriptions
      this.app.rpc.socket.on('session.removed', _.bind(function (data) {
        if (!this.parentView && data.id === this.model.id) {
          this.app.router.session(this.model.get('key'));
        }
      }, this));
      this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

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
        this.ticks.push(new Tick({parentView: this, el: el, model: data,
            mapless: true}, this.app).render());
      }, this));

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.formatName());
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
    },

    // Collect a tick.
    collect: function (data) {

      function _collect () {
        var el = $('<li class="tick" id="' + data.id + '" data-aid="'
            + data.action_id + '">');
        if (!this.parentView) {
          el.addClass('single');
        }

        // Add el to dom.
        var activity = this.$('.session-activity[data-type="' + data.type + '"]');
        if (activity.length === 0) {
          activity = $(this.renderActivity({type: data.type}))
              .insertAfter(this.$('.session-activity').last());  
        }
        el.appendTo($('.session-ticks', activity));

        // create new tick view
        this.ticks.push(new Tick({parentView: this, el: el, model: data,
            mapless: true}, this.app).render());

        // Update model data.
        var action = _.find(this.model.get('actions'), function (a) {
          return a.id === data.action_id;
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

      if (data.session_id === this.model.id) {
        this._remove(data, true);
        _.delay(_.bind(_collect, this), 100);
      }
    },

    // Remove a tick.
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
      var a = t.$el.closest('.session-activity');
      var list = $('.session-ticks', a);

      function _done() {
        t.destroy();
        if (list.children().length === 0) {
          a.remove();
        }
      }

      noslide ? _done(): t.$el.slideUp('fast', _done);
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

    renderActivity: function (a) {
      return this.activityTemp.call(this, {a: a});
    }

  });
});
