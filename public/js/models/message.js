/*
 * Message model
 */

define([
  'Backbone'
], function (Backbone) {
  return Backbone.Model.extend({

    _path: 'bus/chat',
    _type: 'message',

  });
});
