/*
 * Events collection
 */

define([
  'collections/boiler/list',
  'models/event'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
