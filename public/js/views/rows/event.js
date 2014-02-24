/*
 * Event Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/event.html',
  'views/rows/session',
  'views/rows/post'
], function ($, _, Row, mps, rest, template, Session, Post) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'event'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);

      // Determine sub view type.
      var Action;
      switch (this.model.get('action_type')) {
        case 'session': Action = Session; break;
        case 'post': Action = Post; break;
      }
      
      // Render action as sub-view.
      if (Action)
        this.action = new Action({
          parentView: this,
          model: this.model.get('action')
        }, this.app).render(true);

      return this;
    },

    destroy: function () {
      this.action.destroy();
      Row.prototype.destroy.call(this);
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
