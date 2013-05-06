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
      return _.defaults({class: 'comment matte'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      // 'click .branch-icon': 'branch'
    },

  });
});
