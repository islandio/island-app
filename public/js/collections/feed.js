/*
 * Feed collection
 * Ideas and Campaigns list
 */

define([
  'collections/boiler/list',
  'models/card',
], function (List, Model) {
  return List.extend({
    
    _type: 'feed',

    model: Model,

    initialize: function (options) {
      this.options = options;
    }

  });
});
