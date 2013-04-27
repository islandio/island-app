/*
 * Flash model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.id = util.makeID(5);
    },

  });
});
