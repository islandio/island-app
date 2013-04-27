/*
 * Transactions collection
 */

define([
  'collections/boiler/list',
  'models/transaction'
], function (List, Model) {
  return List.extend({
    
    _path: 'market/transaction/list',
    _type: 'transactions',

    model: Model

  });
});
