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
      this.set('weather', new Weather(this.get('weather') || {}));
    },

    grades: ['3', '4', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c',
          '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b',
          '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+'],

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
