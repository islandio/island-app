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

    tempRange: function () {
      var w = this.get('weather');
      if (w.temperature) { // legacy
        return this.tempFtoC(w.temperature);
      } else if (w.temperatureMin && w.temperatureMax) {
        return this.tempFtoC(w.temperatureMin)
            + '-' + this.tempFtoC(w.temperatureMax);
      } else {
        return '?';
      }
    },

    weatherDetail: function () {
      var w = this.get('weather');
      var str = '';
      str += Math.round(w.humidity * 100) + '% humidity, ';
      str += Math.round(w.cloudCover * 100) + '% cloud cover, ';
      str += 'wind speed ' + (w.windSpeed) + ' m/s';
      return str;
    },

    tempFtoC: function (n) {
      return Math.floor((n - 32) * 5/9);
    },

    formatWeatherIconName: function () {
      switch (this.get('weather').icon) {
        default:
        case 'partly-cloudy-day': return 'and partly cloudy'
        case 'clear-day': return 'and clear'

        case 'partly-cloudy-night': return 'and partly cloudy night'
        case 'clear-night': return 'and clear night'

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
