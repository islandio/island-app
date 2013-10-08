/*
 * Media model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    link: function () {
      var link = this.get('link');
      switch (link.type) {
        case 'vimeo':
          return 'https://player.vimeo.com/video/' + link.vid + '?api=1';
          break;
        case 'youtube':
          return '//www.youtube.com/embed/' + link.vid;
          break;
        default:
          return '';
      }
    },

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d');
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    },

  });
});
