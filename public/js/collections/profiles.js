/*
 * Profiles collection.
 */

define([
  'collections/boiler/list',
  'models/profile'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
