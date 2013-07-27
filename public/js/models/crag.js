/*
 * Crag model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/crags/',

    grades: ['9c+', '9c', '9b+', '9b', '9a+', '9a', '8c+', '8c',
        '8b+', '8b', '8a+', '8a', '7c+', '7c', '7b+', '7b', '7a+', '7a',
        '6c+', '6c', '6b+', '6b', '6a+', '6a', '5c', '5b', '5a', '4', '3'],

  });
});
