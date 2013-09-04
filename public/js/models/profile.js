/*
 * Profile model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    description: function () {
      return util.formatText(this.get('description'));
    }

  });
});
