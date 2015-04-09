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

    tempFtoC: function(n) { return Math.floor((n - 32) * 5/9); },

    formatDescription: function () {
      var t = this.attributes;
      var str = '<span class="crag-verb">added the crag</span> *';
      var name = '<a href="/crags/' + t.key + '" class="title navigate">';
      name += '<i class="icon-location"></i> ' + t.name + '</a>';
      name += ' in <a href="/crags/' + t.key.substr(0,3) + '" class="title navigate">';
      name += t.country + '</a>';
      str = str.replace('*', name);
      return str;
    },

    instagramTags: function () {
      var tags = this.get('tags');

      return tags && tags !== '' ? tags:
          util.toUsername(this.get('name'), '').toLowerCase();
    }

  });
});
