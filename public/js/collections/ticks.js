/*
 * Ticks collection.
 */

define([
  'collections/boiler/list',
  'models/tick'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
