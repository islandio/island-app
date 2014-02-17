/*
 * Session model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    name: function () {
      return this.get('name') || new Date(this.get('date')).format('mm/dd/yy');
    },

    duration: function (mins) {
      return (mins / 60) + 'hrs';
    },

    performance: function (int) {
      var str;
      switch (int) {
        case -1: str = 'weak'; break;
        case 0: str = 'average'; break;
        case 1: str = 'strong'; break;
      }
      return str ? 'felt ' + str: '';
    },

  });
});
