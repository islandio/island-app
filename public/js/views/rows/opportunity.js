/*
 * Opportunity Row view
 */

define([
  'jQuery',
  'Underscore',
  'config',
  'views/boiler/row',
  'text!../../../templates/rows/opportunity.html'
], function ($, _, config, Row, template) {
  return Row.extend({

    attributes: function () {
      var disabled = config.getPerson() &&
          !this.options.parentView.parentView.model.get('ended') ? '' : ' disabled';
      return _.defaults({ class: 'opportunity' + disabled },
                        Row.prototype.attributes.call(this));
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

  });
});
