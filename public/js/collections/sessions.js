/*
 * Sessions collection.
 */

define([
  'collections/boiler/list',
  'models/session'
], function (List, Model) {
  return List.extend({

    model: Model,

    comparator: function (model) {
      return -model.get('date');
    },

  });
});
