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

    link: function () {
      var vid = util.parseVideoURL(this.get('body'));
      if (vid) {
        switch (vid.link.type) {
          case 'vimeo':
            this.set('link', 'https://player.vimeo.com/video/' + vid.link.id + '?api=1');
            break;
          case 'youtube':
            this.set('link', '//www.youtube.com/embed/' + vid.link.id);
            break;
        }
        return true;
      }
      // TODO: add other link types.
      // e.g. article, photo, etc.
      else return false;
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    },

  });
});
