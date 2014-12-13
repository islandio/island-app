/*
 * Post model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {
      this.set('videoEmbeds', util.getVideoLinks(this.get('body')));
    },

    formatAuthorFor: function (member) {
      if (member && member.id === this.get('author').id) {
        return 'You';
      } else {
        return this.get('author').displayName;
      }
    },

    explain: function () {
      var name = '';
      var target = this.get('event').target;
      if (target) {
        switch (target.t) {
          case 'member':
            if (target.u) {
              name += ' &rarr; <a href="' + target.u
                  + '" class="title navigate">' + target.a + '</a>';
            }
            break;
          case 'crag': case 'ascent':
            name += ' &rarr; <a href="' + target.s
                + '" class="title navigate">' + target.n + '</a>';
            break;
        }
      }
      return name === '' ? ' added a <a href="/' + this.get('key')
          + '" class="title navigate">post</a>.': name;
    },

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mm.dd.yy');
    },

    body: function (full) {
      var txt = util.formatText(this.get('body'));
      return txt;
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    },

  });
});
