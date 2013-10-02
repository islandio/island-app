/*
 * Media collection.
 */

define([
  'collections/boiler/list',
  'models/media'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
