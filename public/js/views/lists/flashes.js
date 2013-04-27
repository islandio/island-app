/*
 * Flash Messages List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/flashes.html',
  'collections/flashes',
  'views/rows/flash'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#block_messages > ul',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      
      // Shell subscriptions:
      mps.subscribe('flash/new', _.bind(function (data, clear) {
        if (clear)
          this.destroy();
        this.collection.push(data);
      }, this));

      // Call super init.
      List.prototype.initialize.call(this, app, options);
    },

    // Kill this view.
    destroy: function () {
      _.each(this.views, function (v) {
        v.destroy();
      });
    }

  });
});
