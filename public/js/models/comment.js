/*
 * Comment model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/comments/',

    body: function () {
      return util.formatText(this.get('body'));
    },

  });
});
