/*
 * Flashes collection
 */

define([
  'collections/boiler/list',
  'models/flash'
], function (List, Model) {
  return List.extend({
    
    _type: 'flash',

    model: Model

  });
});
