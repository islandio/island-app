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
  'views/session.new',
  'text!../../../templates/rows/session.html',
  'text!../../../templates/rows/session.activity.html',
  'text!../../../templates/rows/session.tick.html',
  'text!../../../templates/session.title.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html',
  'views/minimap'
], function ($, _, Backbone, mps, rest, util, Model, NewSession, template,
      activityTemp, tickTemp, title, Comments, confirm, MiniMap) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'session'};
      if (this.model) attrs.id = this.model.id;
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);
      this.activityTemp = _.template(activityTemp);
      this.tickTemp = _.template(tickTemp);
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .session-delete': 'delete',
      'click .session-tick-button': 'edit',
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
      }

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.formatName());

        // Render title.
        this.title = _.template(title).call(this);
      }

      // Trigger setup.
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

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'session'
      });

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
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
      this.comments.destroy();
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

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Deleting a session also deletes all'
            + ' associated bouldering and climbing.'
            + ' Delete this session forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the session.
        rest.delete('/api/sessions/' + this.model.id,
            {}, _.bind(function (err, data) {
          if (err) {
            return console.log(err);
          }

          // close the modal.
          $.fancybox.close();

          // Go home if single view.
          if (!this.parentView) {
            this.app.router.navigate('/', {trigger: true, replace: true});
          }

        }, this));

      }, this));

      return false;
    },

    edit: function (e) {
      e.preventDefault();
      var tid = $(e.target).closest('li').attr('id');
      var aid = $(e.target).closest('li').data('aid');
      var cid = $(e.target).closest('li').data('cid');
      var type = $(e.target).closest('li').data('type');
      var action = _.find(this.model.get('actions'), function (a) {
        return a.type === type;
      });
      var tick = _.find(action.ticks, function (t) {
        return t.id === tid;
      });
      new NewSession(this.app, {tick: tick, crag_id: cid, ascent_id: aid})
          .render();
    },

    when: function () {
      if (!this.model.get('updated')) return;
      if (!this.time) {
        this.time = this.$('time.created:first');
      }
      this.time.text(util.getRelativeTime(this.model.get('updated')));
    },

    renderActivity: function (a) {
      return this.activityTemp.call(this, {a: a});
    },

    renderTick: function (t) {
      return this.tickTemp.call(this, {t: t});
    }

  });
});
