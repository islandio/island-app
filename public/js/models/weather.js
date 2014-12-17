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

    daily: function () {
      var d = this.get('daily');
      if (!d || !d.data || d.data.length === 0) {
        return;
      }
      return d.data[0];
    },

    hourly: function (hr) {
      if (!this.get('hourly')) {
        return;
      }
      if (hr * 10 % 10 === 0) {
        return this.get('hourly').data[hr];
      } else {
        var l = this.get('hourly').data[hr - 0.5];
        var h = this.get('hourly').data[hr + 0.5];
        var a = {};
        _.each(l, function (v, k) {
          if (_.isNumber(v)) {
            a[k] = (v + h[k]) / 2;
          } else {
            a[k] = v;
          }
        });
        return a;
      }
    },

    dailyTempRange: function () {
      var d = this.daily();
      if (!d) {
        return '?';
      }
      return this.tempFtoC(d.temperatureMin) + ' to '
          + this.tempFtoC(d.temperatureMax);
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
