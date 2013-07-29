/*
 * Posts collection.
 */

define([
  'collections/boiler/list',
  'models/post'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
