/*
 * Session model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    grades: ['3', '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c',
          '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b',
          '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+'],

    name: function () {
      return this.get('name') || new Date(this.get('date')).format('mm/dd/yy');
    },

    duration: function (mins) {
      return (mins / 60) + 'hrs';
    },

    performance: function (num) {
      var str;
      switch (num) {
        case -1: str = 'weak'; break;
        case 0: str = 'average'; break;
        case 1: str = 'strong'; break;
      }
      return str ? 'Felt ' + str: '';
    },

    grade: function (num, feel) {
      if (num === undefined) return;
      var str = '';
      switch (feel) {
        case -1: str = ' (soft)'; break;
        case 0: str = ''; break;
        case 1: str = ' (hard)'; break;
      }
      return this.grades[num] + str;
    }

  });
});
