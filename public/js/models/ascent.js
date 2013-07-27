/*
 * Ascent model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/ascents/',

    parentKey: function () {
      return this.get('key').split('/').slice(0, 2).join('/');
    }

  });
});
