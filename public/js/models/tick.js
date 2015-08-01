/*
 * Tick model
 */

define([
  'Underscore',
  'Backbone',
  'util',
  'models/weather'
], function (_, Backbone, util, Weather) {
  return Backbone.Model.extend({

    initialize: function (attributes, options) {
      this.set('videoEmbeds', util.getVideoLinks(this.get('note')));

      var time = this.get('time');
      if (time) {
        var d = new Date(this.get('date'));
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var secs = (d.valueOf() / 1000) + time * 60;
        this.set('ts', secs);
      }

      if (!this.get('weather')) {
        var w = this.get('session') ? this.get('session').weather: null;
        if (w) {
          w.prefs = this.get('prefs');
        }
        this.set('weather', new Weather(w || {}));
      }

      this.gradeConverter = options.gradeConverter;
    },

    formatNote: function () {
      return util.formatText(this.get('note'), true);
    },

    formatDate: function (compact) {
      if (this.get('ts')) {
        var d = new Date(this.get('ts') * 1000);
        var dstr = '';
        if (!compact) {
          dstr += d.format('h:MM TT') + '<br />';
        }
        return dstr + d.format('mmm d, yyyy');
      } else {
        return new Date(this.get('date')).format('mediumDate');
      }
    },

    formatTime: function () {
      if (this.get('ts')) {
        return new Date(this.get('ts') * 1000).format('h:MM TT');
      } else {
        return '';
      }
    },

    formatGrade: function () {
      var num = this.get('grade');
      if (num === undefined) return '';
      var str = '';
      switch (this.get('feel')) {
        case -1: str = ' (soft)'; break;
        case 0: str = ''; break;
        case 1: str = ' (hard)'; break;
      }
      var type = this.get('type');
      return this.gradeConverter[type].indexes(num) + str;
    },

    formatDescription: function () {
      var t = this.attributes;
      var str = '<span class="tick-verb">';

      if (t.sent) {
        var v;
        if (t.first) {
          v = 'opened';
        } else if (t.firstf) {
          v = 'sent (FFA)';
        }
        if (t.tries === 1) {
          if (!v) {
            v = 'onsighted';
          }
          str += v + '</span> *';
        } else if (t.tries === 2) {
          if (!v) {
            v = 'flashed';
          }
          str += v + '</span> *';
        } else if (t.tries === 3) {
          if (!v) {
            v = 'sent';
          }
          str += v + '</span> * 2nd go';
        } else if (t.tries === 4) {
          if (!v) {
            v = 'sent';
          }
          str += v + '</span> * 3rd go';
        } else if (!t.tries || t.tries === 5) {
          if (!v) {
            v = 'sent';
          }
          str += v + '</span> *';
        }
      } else {
        str += 'tried</span> *';
      }

      var name = '<a href="/crags/' + t.ascent.key + '" class="title navigate">';
      name += t.ascent.name + '</a>';
      name += ' at <a href="/crags/' + t.crag.key + '" class="title navigate">';
      name += t.crag.name + '</a>';
      str = str.replace('*', name);
      return str;
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

    formatTickGrades: function (grade, feel, country) {
      if (grade === undefined) return;
      var str = '';
      switch (feel) {
        case -1: str = ' (soft)'; break;
        case 0: str = ''; break;
        case 1: str = ' (hard)'; break;
      }
      var type = this.get('type');
      var prefs = this.get('prefs');
      var system;
      if (prefs) {
        system = type === 'r' ? prefs.grades.route: prefs.grades.boulder;
      }
      var fn = this.gradeConverter[type];
      // Deals with indexes vs string grades
      var g = fn.indexes(grade, country, system);
      // Add feel only if its not an array
      return (str !== '' && !_.isArray(g)) ? g + str : g;
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

  });
});
