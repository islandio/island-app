/*
 * Crag model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      if (!this.get('ticks').b) {
        this.get('ticks').b = [];
      }
      if (!this.get('ticks').r) {
        this.get('ticks').r = [];
      }
    },

    grades: ['3', '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+',
        '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c',
        '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+'],

    ticksByGrade: function (type) {
      var ticks = {};
      _.each(this.get('ticks')[type], _.bind(function (t) {
        if (t.grade) {
          if (!ticks[this.grades[t.grade]]) {
            ticks[this.grades[t.grade]] = [];
          }
          ticks[this.grades[t.grade]].push(t);
        } else {
          if (!ticks['not graded']) {
            ticks['not graded'] = [];
          }
          ticks['not graded'].push(t);
        }
      }, this));
      return ticks;
    },

    count: function (n) {
      return n !== 0 ? '~' + util.addCommas(n): 0;
    },

  });
});
