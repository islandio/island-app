/*
 * Profile Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'models/profile',
  'text!../../../templates/rows/profile.html',
  'text!../../../templates/profile.title.html',
  'views/lists/posts'
], function ($, _, mps, rest, Row, Model, template, title, Posts) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'profile'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Allow single rendering (no parent view)
      if (!options.parentView)
        this.model = new Model(this.app.profile.content.page);

      // Boiler init.
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate',
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);

      // Set page title
      if (!this.parentView) {
        if (this.model.get('role') !== 2)
          this.$el.addClass('single');
        else this.$el.addClass('company');
        var doctitle = this.model.get('username');
        if (this.model.get('displayName') !== '')
          doctitle += ' (' + this.model.get('displayName') + ')';
        this.app.title(doctitle);

        // Render title.
        this.title = _.template(title).call(this);
      }

      return this;
    },

    setup: function () {
      Row.prototype.setup.call(this);

      if (!this.parentView) {

        // Set map view.
        mps.publish('map/fly', [this.model.get('location') 
            || this.model.get('hometown')]);

        // Render posts.
        this.posts = new Posts(this.app, {parentView: this, reverse: true});
      }
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.posts) this.posts.destroy();
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
