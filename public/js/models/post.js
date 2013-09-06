/*
 * Post model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d');
    },

    body: function (full) {
      var txt = util.formatText(this.get('body'));
      return full ? txt: util.blurb(txt, 500);
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    },

  });
});
