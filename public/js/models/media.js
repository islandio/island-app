/*
 * Media model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function (attributes, options) {
      var a = this.get('action');
      var str = a.body || a.note;
      this.set('videoEmbeds', util.getVideoLinks(str));
      this.set('path', this.get('action_type') === 'post' ? a.key: 'efforts/' +
          a.key);
    },

    getTitle: function () {
      var str;
      var a = this.get('action');
      switch (this.get('action_type')) {
        case 'post':
          if (a.title) {
            str = _.str.prune(a.title, 30);
          } else {
            var date = new Date(a.created);
            str = date.format('mm.dd.yy');
          }
          break;
        case 'tick':
          str = _.str.prune(a.ascent.name, 30);
          break;
      }
      return str;
    }

  });
});
