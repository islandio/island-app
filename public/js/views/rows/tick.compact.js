/*
 * Sidebar Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/tick.compact.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    tagName: 'li',

    attributes: function () {
      var back = this.model.collection.indexOf(this.model) % 2 === 0 ?
          '#fcfcfc': '#fcfcfc';
      return _.defaults({
        class: 'sidebar-tick',
        style: 'background:' + back + ';'
      }, Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
      this.model.gradeConverter = this.app.gradeConverter;
    },

    setup: function () {
      return Row.prototype.setup.call(this);
    },

    events: {
      'click .navigate': 'navigate'
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    _remove: function (cb) {
      this.$el.children().fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
