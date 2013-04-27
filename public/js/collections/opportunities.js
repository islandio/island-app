/*
 * Opportunities collection
 */

define([
  'collections/boiler/list',
  'models/opportunity'
], function (List, Model) {
  return List.extend({
    
    _path: 'opportunity/list',
    _type: 'opportunities',

    model: Model

  });
});
