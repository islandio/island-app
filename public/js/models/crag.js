/*
 * Crag model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    count: function (n) {
      return n !== 0 ? '~' + util.addCommas(n): 0;
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
      var str, name;
      if (t.parent) {
        str = '<span class="crag-verb">added the sector</span> *';
        name = '<a href="/crags/' + t.key + '" class="title navigate">';
        name += '<i class="icon-location"></i>' + t.name + '</a>';
        name += ' in <a href="/crags/' + t.parent.key + '" class="title navigate">';
        name += '<i class="icon-location"></i>' + t.parent.name + '</a>';
      } else {
        str = '<span class="crag-verb">added the crag</span> *';
        name = '<a href="/crags/' + t.key + '" class="title navigate">';
        name += '<i class="icon-location"></i>' + t.name + '</a>';
        name += ' in <a href="/crags/' + t.key.substr(0,3) + '" class="title navigate">';
        name += t.country + '</a>';
      }
      str = str.replace('*', name);
      return str;
    },

    formatOverview: function () {
      var txt = this.get('overview') || '';
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
