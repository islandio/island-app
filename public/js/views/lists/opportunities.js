/*
 * Opportunities List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/opportunities.html',
  'collections/opportunities',
  'views/rows/opportunity'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#opportunities',

    initialize: function (options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      List.prototype.initialize.call(this, options);
    }

  });
});
