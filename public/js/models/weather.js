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
      return this.getTemp(minT) + ' to ' + this.getTemp(maxT);
    },

    getTemp: function (n) {
      var units = this.get('prefs').units;
      var t = units === 'si' ? this.tempFtoC(n): n;
      return Math.floor(t);
    },

    getSpeed: function (n) {
      var units = this.get('prefs').units;
      var s = units === 'si' ? this.miToKm(n): n;
      return s.toFixed(1);
    },

    getIntensity: function (n) {
      var units = this.get('prefs').units;
      var s = units === 'si' ? this.inToCm(n): n;
      return s.toFixed(3);
    },

    getTempUnits: function () {
      var units = this.get('prefs').units;
      return units === 'si' ? 'C': 'F';
    },

    getSpeedUnits: function () {
      var units = this.get('prefs').units;
      return units === 'si' ? 'km/hr': 'mi/hr';
    },

    getIntensityUnits: function () {
      var units = this.get('prefs').units;
      return units === 'si' ? 'cm/hr': 'in/hr';
    },

    tempFtoC: function (n) {
      return (n - 32) * 5/9;
    },

    miToKm: function (n) {
      return n * 1.60934;
    },

    inToCm: function (n) {
      return n * 2.54;
    },

    getWeatherIconName: function (str) {
      switch (str) {
        default:
        case 'partly-cloudy-day': return 'and partly cloudy';
        case 'clear-day': return 'and clear';

        case 'partly-cloudy-night': return 'and partly cloudy night';
        case 'clear-night': return 'and clear night';

        case 'cloudy': return 'and cloudy';
        case 'rain': return 'and raining';
        case 'sleet': return 'and sleeting';
        case 'snow': return 'and snowing';
        case 'wind': return 'and windy';
        case 'fog': return 'and foggy';
      }
    }

  });
});
