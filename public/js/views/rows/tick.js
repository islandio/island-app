/*
 * Tick View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/tick',
  'text!../../../templates/rows/tick.html',
  'text!../../../templates/tick.title.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html',
  'views/minimap',
  'views/session.new'
], function ($, _, Backbone, mps, rest, util, Model, template, title, Comments,
      confirm, MiniMap, NewSession) {
  return Backbone.View.extend({

    tagName: 'li',

    attributes: function () {
      var attrs = {class: 'tick'};
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
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('tick.new', _.bind(function (data) {

      }, this));
      this.app.rpc.socket.on('tick.removed', _.bind(function (data) {

      }, this));

      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .session-tick-button': 'edit'
    },

    render: function () {

      // Render content
      if (this.options.el) {
        this.setElement(this.options.el);
      }
      this.$el.html(this.template.call(this));
      if (!this.options.el) {
        if (this.parentView) {
          this.$el.prependTo(this.parentView.$('.event-right'));
        } else {
          this.$el.attr('id', this.model.id);
          this.$el.appendTo(this.wrap);
        }
      }
      if (this.app.profile.member && this.model.get('author').id
          === this.app.profile.member.id) {
        this.$el.addClass('own');
      }
      if (this.model.get('sent')) {
        this.$el.addClass('sent');
      }

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single');
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.get('ascent').name);
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
      if (!this.parentView) {
        this.map = new MiniMap(this.app, {
          el: this.$('.mini-map'),
          location: this.model.get('ascent').location
        }).render();
      }

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'tick',
        hideInput: true
      });

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.map) {
        this.map.destroy();
      }
      this.comments.destroy();
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

    edit: function (e) {
      e.preventDefault();
      new NewSession(this.app, {
        tick: this.model.attributes,
        crag_id: this.model.get('crag_id'),
        ascent_id: this.model.get('ascent').id
      }).render();
    },

  });
});
