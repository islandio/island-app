/*
 * Event Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/event.html'
], function ($, _, Row, mps, rest, template) {
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

    events: {
      'click': 'navigate',
    },

    navigate: function (e) {
      e.preventDefault();
      var path = this.model.get('data').target.s;
      if (path) mps.publish('navigate', [path]);
      return false;
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
