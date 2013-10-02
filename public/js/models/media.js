/*
 * Media model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d');
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    },

  });
});
