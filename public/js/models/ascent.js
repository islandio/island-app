/*
 * Ascent model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    parentKey: function () {
      return this.get('key').split('/').slice(0, 2).join('/');
    },

    getTemp: function (n) {
      var units = this.get('prefs').units;
      var t = units === 'si' ? this.tempFtoC(n): n;
      return Math.floor(t);
    },

    getTempUnits: function () {
      var units = this.get('prefs').units;
      return units === 'si' ? 'C': 'F';
    },

    tempFtoC: function(n) {
      return (n - 32) * 5/9;
    },

    formatDescription: function () {
      var t = this.attributes;
      var type = t.type === 'b' ? 'boulder problem': 'route';
      var str = '<span class="ascent-verb">added the ' + type + '</span> *';
      var name = '<a href="/crags/' + t.key + '" class="title navigate">"';
      name += t.name + '"</a>';
      name += ' in <a href="/crags/' + t.crag.key + '" class="title navigate">';
      name += '<i class="icon-location"></i> ' + t.crag.name + ', ' +
          t.country + '</a>';
      str = str.replace('*', name);
      return str;
    },

    formatNote: function () {
      var txt = this.get('note') || '';
      if (txt.trim() === '') {
        return false;
      }
      return util.formatText(txt);
    },

    instagramTags: function () {
      var tags = this.get('tags');

      return tags && tags !== '' ? tags.replace(' ', '').replace(',', ''):
          util.toUsername(this.get('name'), '').toLowerCase();
    }

  });
});
