/*
 * Comment Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/comment.html'
], function ($, _, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'comment'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {},

  });
});
