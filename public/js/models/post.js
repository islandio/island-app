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
              name += ' &rarr; <a href="' + target.u +
                  '" class="title navigate">' + target.a + '</a>';
            }
            break;
          case 'crag': case 'ascent':
            name += ' &rarr; <a href="' + target.s +
                '" class="title navigate">' + target.n + '</a>';
            break;
        }
      }
      if (name !== '') {
        return name;
      }
      var str = ' added a <a href="/' + this.get('key') +
          '" class="title navigate">post</a>';
      var rm = this.get('remote_media');
      if (rm) {
        var rmt = this.get('type');
        switch (rmt) {
          case 'instagram':
            str += ' via <a href="' + rm.link +
                '" class="title" target="_blank">' + _.str.capitalize(rmt) +
                '</a>.';
            break;
        }
      } else {
        str += '.';
      }
      return str;
    },

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mm.dd.yy');
    },

    formatText: function (txt, breaks, prune) {
      txt = util.formatText(txt, breaks);

      // Replace @mentions with links to users:
      txt = txt.replace(/\u0091@(.*?)\u0092/g, function(m, p1) {
        return '<strong><a href="/' + p1 + '" class="title">' +
            '@' + p1 + '</a></strong>';
      });
      return prune ? _.str.prune(txt, prune) : txt;
    },

    views: function () {
      return util.addCommas(this.get('vcnt') || 0);
    }

  });
});
