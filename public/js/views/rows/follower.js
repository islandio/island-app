/*
 * Sidebar Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'views/boiler/row',
  'text!../../../templates/rows/follower.html'
], function ($, _, mps, rest, Row, template) {
  return Row.extend({

    tagName: 'div',

    attributes: function () {
      return _.defaults({class: 'sidebar-follow'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    setup: function () {

      // For rendering tooltips
      this.$('.tooltip').tooltipster({delay: 600, multiple: true});

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
