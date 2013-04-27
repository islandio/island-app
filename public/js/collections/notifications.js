/*
 * Notifications collection
 */

define([
  'collections/boiler/list',
  'models/notification'
], function (List, Model) {
  return List.extend({
    
    type: 'notification',

    model: Model,

    initialize: function (options) {
      this.options = options;
    }

  });
});
