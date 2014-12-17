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
      return this.model ?
          _.defaults({class: 'flash-' + this.model.get('level')},
          Row.prototype.attributes.call(this)): {};
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click .flash-remove': 'delete'
    },

    render: function (single) {
      Row.prototype.render.call(this, single);
      if (!this.model.get('sticky')) {
        var wait = this.model.collection.options.type === 'block' ?
          8000: 3000;
        _.delay(_.bind(this.delete, this), wait);
      }
    },

    delete: function (e) {
      if (e) e.preventDefault();
      this.parentView._remove({id: this.model.id});
    },

    _remove: function (cb) {
      var fn = this.model.collection.options.type === 'block' ?
          'slideUp': 'fadeOut';
      this.$el[fn]('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
