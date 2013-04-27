/*
 * Comments collection.
 */

define([
  'collections/boiler/list',
  'models/comment'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
