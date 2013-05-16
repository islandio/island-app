/*
 * Notifications collection
 */

define([
  'collections/boiler/list',
  'models/notification'
], function (List, Model) {
  return List.extend({

    model: Model

  });
});
