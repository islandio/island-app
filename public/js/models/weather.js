/*
 * Weather model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.set('summary', _.str.strLeft(this.get('summary'), '.'));
    },

    tempRange: function () {
      var w = this.attributes;
      var str = '';
      if (w.temperature) { // legacy
        str = this.tempFtoC(w.temperature);
      } else if (w.temperatureMin && w.temperatureMax) {
        str = this.tempFtoC(w.temperatureMin)
            + ' to ' + this.tempFtoC(w.temperatureMax);
      } else {
        str = '?';
      }
      return str + '&degC';
    },

    tempFtoC: function (n) {
      return Math.floor((n - 32) * 5/9);
    },

    getWeatherIconName: function () {
      switch (this.get('icon')) {
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
