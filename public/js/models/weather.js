/*
 * Weather model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {},

    dailyTempRange: function () {
      var daily = this.get('daily');
      var minT = daily.temperatureMin;
      var maxT = daily.temperatureMax;
      if (!minT || !maxT) {
        return '?';
      }
      return this.tempFtoC(minT) + ' to ' + this.tempFtoC(maxT);
    },

    tempFtoC: function (n) {
      return Math.floor((n - 32) * 5/9);
    },

    getWeatherIconName: function (str) {
      switch (str) {
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
