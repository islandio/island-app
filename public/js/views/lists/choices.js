/*
 * Choices List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/choices.html',
  'collections/choices',
  'views/rows/choice'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#search_display',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);
    },

  });
});
