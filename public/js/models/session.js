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

    formatAuthorFor: function (member) {
      if (member && member.id === this.get('author').id)
        return 'You';
      else
        return this.get('author').displayName;
    },

    formatName: function () {
      return this.get('name') || new Date(this.get('date')).format('mm/dd/yy');
    },

    tempFtoC: function(n) { return Math.floor((n - 32) * 5/9); },

    formatWeatherIconName: function(str) {
      switch (str) {
        default:
        case 'partly-cloudy-day':
        case 'clear-day': return ''

        case 'partly-cloudy-night':
        case 'clear-night': return 'and night'

        case 'cloudy': return 'and cloudy'
        case 'rain': return 'and raining'
        case 'sleet': return 'and sleeting'
        case 'snow': return 'and snowing'
        case 'wind': return 'and windy'
        case 'fog': return 'and foggy'
      }
    }

  });
});
