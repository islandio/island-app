/*
 * Media Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/media.html'
], function ($, _, Row, mps, rest, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'media'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);

      var model = this.model.get('action');
      model.event = this.model.get('data');
      var params = {
        parentView: this,
        model: model
      };
      
      // this.action = new Action(params, this.app).render(true);

      return this;
    },

    setup: function () {
      this.$('.tooltip').tooltipster({delay: 300, multiple: true});
      Row.prototype.setup.call(this);
    },

    destroy: function () {
      if (this.action) {
        // this.action.destroy();
      }
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
