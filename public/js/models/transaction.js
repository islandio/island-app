/*
 * Transaction model
 */

define([
  'Backbone'
], function (Backbone) {
  return Backbone.Model.extend({

    _path: 'market/transaction',
    _type: 'transaction',

  });
});
