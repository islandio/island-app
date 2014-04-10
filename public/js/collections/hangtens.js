/*
 * Hangtens collection.
 */

define([
  'collections/boiler/list',
  'models/hangten'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
