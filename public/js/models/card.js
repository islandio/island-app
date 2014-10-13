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
          var k = 'not graded by you';
          if (!ticks[k]) {
            ticks[k] = [];
          }
          ticks[k].push(t);
        }
      }, this));
      return ticks;
    },

    formatActivityDuration: function (mins) {
      if (!mins) return '';
      var hrs = mins / 60;
      var units = hrs !== 1 ? 'hrs': 'hr';
      return hrs + '<span class="units"> ' + units + '</span>';
    },

    formatActivityPerformance: function (num) {
      var str;
      switch (num) {
        case -1: str = 'weak'; break;
        case 0: str = 'good'; break;
        case 1: str = 'strong'; break;
      }
      return str ? 'felt ' + str: '';
    },

    formatTickGrade: function (num, feel) {
      if (num === undefined) return;
      var str = '';
      switch (feel) {
        case -1: str = ' (soft)'; break;
        case 0: str = ''; break;
        case 1: str = ' (hard)'; break;
      }
      return this.grades[num] + str;
    },

    formatTickDetails: function (t) {
      var parts = [];
      if (t.first) parts.push('FA');
      else if (t.firstf) parts.push('FFA');
      if (t.tries === 1) parts.push('onsight');
      else if (t.tries === 2) parts.push('flash');
      else if (t.tries === 3) parts.push('2nd go');
      else if (t.tries === 4) parts.push('3rd go');
      else if (!t.tries || t.tries === 5) parts.push('redpoint');
      return parts.join(', ');
    },

    count: function (n) {
      return n !== 0 ? '~' + util.addCommas(n): 0;
    },

  });
});
