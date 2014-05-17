/*
 * Tick model
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

    formatAuthorFor: function (member) {
      if (member && member.id === this.get('author').id)
        return 'You';
      else
        return this.get('author').displayName;
    },

    formatName: function () {
      return this.get('name') || new Date(this.get('date')).format('mm/dd/yy');
    },

    formatDate: function () {
      var date = new Date(this.get('date'));
      return date.format('mmm d');
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