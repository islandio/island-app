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

    initialize: function () {
      this.set('videoEmbeds', util.getVideoLinks(this.get('note')));
      if (this.get('session') && this.get('session').weather) {
        this.set('weather', new Weather(this.get('session').weather));
      }
    },

    grades: ['3', '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c',
          '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b',
          '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+'],

    formatGrade: function () {
      var num = this.get('grade');
      if (num === undefined) return '';
      var str = '';
      switch (this.get('feel')) {
        case -1: str = ' (soft)'; break;
        case 0: str = ''; break;
        case 1: str = ' (hard)'; break;
      }
      return this.grades[num] + str;
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

  });
});
