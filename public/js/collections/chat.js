/*
 * Chats collection
 */

define([
  'collections/boiler/list',
  'models/message'
], function (List, Model) {
  return List.extend({
    
    _path: 'bus/chat/list',
    _type: 'chat',

    model: Model

  });
});
