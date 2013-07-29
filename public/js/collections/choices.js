/*
 * Choices collection
 */

define([
  'collections/boiler/list',
  'models/choice'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
