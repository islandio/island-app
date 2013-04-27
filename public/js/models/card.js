/*
 * Card model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    blurb: function (str, len) {
      if (!len) len = 80;
      return util.blurb(str, len);
    },

    getShellType: function () {
      switch (this.get('code')) {
        case 'i': return 'idea'; break;
        case 'c': return 'campaign'; break;
      }
    }

  });
});
