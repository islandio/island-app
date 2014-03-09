/*
 * Choice model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    href: function () {
      var href;
      switch (this.get('_type')) {
        case 'members':
          href = '/' + this.get('username');
          break;
        case 'posts':
          href = '/' + this.get('key');
          break;
        case 'crags':
          href = '/crags/' + this.get('key');
          break;
      }
      return href;
    },

    title: function () {
      var title = '';
      switch (this.get('_type')) {
        case 'members':
          title += '<strong>' + this.get('displayName') + '</strong>';
          title += ' (@' + this.get('username') + ')';
          break;
        case 'posts':
          title += this.get('type') === 'video' ?
              '<i class="icon-youtube-play"></i>':
              '<i class="icon-picture"></i>';
          var tmp = '';
          if (this.get('title') && this.get('title') !== '')
            tmp += '<strong>' + this.get('title') + '</strong>';
          if (this.get('body') && this.get('body') !== '') {
            if (tmp !== '') tmp += ': ';
            tmp += _.str.prune(this.get('body'), 100);
          } 
          if (tmp === '')
            title += this.get('key');
          else title += tmp;
          break;
        case 'crags':
          title += '<strong>' + this.get('name') + '</strong>, '
            + this.get('country');
          break;
      }
      return title;
    },

    term: function () {
      var term = '';
      switch (this.get('_type')) {
        case 'members':
          term += this.get('username');
          if (this.get('displayName') && this.get('displayName') !== '')
            term += ' (' + this.get('displayName') + ')';
          break;
        case 'posts':
          term += this.get('title');
          break;
        case 'crags':
          term += this.get('name');
          break;
      }
      return term;
    },

  });
});
