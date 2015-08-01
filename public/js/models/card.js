/*
 * Scorecard model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function (attributes, options) {
      if (!this.get('ticks').b) {
        this.get('ticks').b = [];
      }
      if (!this.get('ticks').r) {
        this.get('ticks').r = [];
      }
      this.gradeConverter = options.gradeConverter;
      this.prefs = options.prefs;
    },

    ticksByGrade: function (type) {
      var ticks = {};
      _.each(this.get('ticks')[type], _.bind(function (t) {
        if (t.grade !== undefined) {
          var system = type === 'r' ? this.prefs.grades.route:
              this.prefs.grades.boulder;
          var grade = this.gradeConverter[type].convert(t.grade, null, system);
          if (!ticks[grade]) {
            ticks[grade] = [];
          }
          ticks[grade].push(t);
        } else {
          var k = 'ungraded';
          if (!ticks[k]) {
            ticks[k] = [];
          }
          ticks[k].push(t);
        }
      }, this));
      return ticks;
    },

    // formatActivityDuration: function (mins) {
    //   if (!mins) return '';
    //   var hrs = mins / 60;
    //   var units = hrs !== 1 ? 'hrs': 'hr';
    //   return hrs + '<span class="units"> ' + units + '</span>';
    // },

    // formatActivityPerformance: function (num) {
    //   var str;
    //   switch (num) {
    //     case -1: str = 'weak'; break;
    //     case 0: str = 'good'; break;
    //     case 1: str = 'strong'; break;
    //   }
    //   return str ? 'felt ' + str: '';
    // },

    // formatTickDetails: function (t) {
    //   var parts = [];
    //   if (t.first) parts.push('FA');
    //   else if (t.firstf) parts.push('FFA');
    //   if (t.tries === 1) parts.push('onsight');
    //   else if (t.tries === 2) parts.push('flash');
    //   else if (t.tries === 3) parts.push('2nd go');
    //   else if (t.tries === 4) parts.push('3rd go');
    //   else if (!t.tries || t.tries === 5) parts.push('redpoint');
    //   return parts.join(', ');
    // },

    // count: function (n) {
    //   return n !== 0 ? '~' + util.addCommas(n): 0;
    // },

  });
});
