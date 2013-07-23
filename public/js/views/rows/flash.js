/*
 * Flash Message Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/flash.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'li',

    attributes: function () {
      return this.model ? _.defaults({ class: 'block-' + this.model.get('level') },
                                    Row.prototype.attributes.call(this)) : {};
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click .icon-cancel': 'delete',
      'click #to_campaign': 'build'
    },

    render: function (single) {
      Row.prototype.render.call(this, single);
      _.delay(_.bind(this.delete, this), 8000);
    },

    delete: function (e) {
      if (e) e.preventDefault();
      this.parentView._remove({id: this.model.id});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        clearInterval(this.timer);
        this.destroy();
        cb();
      }, this));
    },

  });
});
