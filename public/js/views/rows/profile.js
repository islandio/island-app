/*
 * Profile Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rpc',
  'views/boiler/row',
  'models/profile',
  'text!../../../templates/rows/profile.html'
], function ($, _, mps, rpc, Row, Model, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'profile'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Allow single rendering (no parent view)
      if (!options.parentView) {
        this.model = new Model(this.app.profile.content.page);
      }

      // Boiler init.
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate'
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);

      if (!this.parentView) {
        this.$el.addClass('single')
        var title = this.model.get('username');
        if (this.model.get('displayName') !== '')
          title += ' (' + this.model.get('displayName') + ')';
        this.app.title(title);
      }

      return this;
    },

    setup: function () {
      Row.prototype.setup.call(this);
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      Row.prototype.destroy.call(this);
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
