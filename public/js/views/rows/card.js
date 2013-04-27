/*
 * Card Row view
 */

define([
  // dependencies
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/card.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({ class: 'card' },
                      Row.prototype.attributes.call(this));
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click a': 'view',
    },

    view: function (e) {
      e.preventDefault();

      // Route to the idea/campaign:
      var path = this.$('a').attr('href');
      mps.publish('navigate', [path]);
      
      return false;
    },

  });
});
