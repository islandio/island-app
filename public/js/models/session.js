/*
 * Session model
 */

define([
  'Underscore',
  'Backbone',
  'util',
  'models/weather'
], function (_, Backbone, util, Weather) {
  return Backbone.Model.extend({

    initialize: function () {
      var w = this.get('weather');
      if (w) {
        w.prefs = this.get('prefs');
      }
      this.set('weather', new Weather(w || {}));
    },

    formatAuthorFor: function (member) {
      if (member && member.id === this.get('author').id) {
        return 'You';
      } else {
        return this.get('author').displayName;
      }
    },

    formatName: function () {
      return new Date(this.get('date')).format('ddd, mmm d, yyyy');
    }

  });
});
