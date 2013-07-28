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
      if (this.get('username'))
        return '/' + this.get('username');
      else if (this.get('crag'))
        return '/crags/' + this.get('key');
      else if (this.get('type'))
        return '/' + this.get('key');
      else
        return '/crags/' + this.get('key');
    },

    title: function () {
      var title = '';
      if (this.get('username')) {
        title += '<strong>' + this.get('username') + '</strong>';
        if (this.get('displayName') && this.get('displayName') !== '')
          title += ' (' + this.get('displayName') + ')';
      } else if (this.get('crag')) {
        title += '<strong>' + this.get('name') + '</strong>, '
            + this.get('crag') + ', ' + this.get('country');
      } else if (this.get('type')) {
        title += this.get('type') === 'video' ?
            '<i class="icon-youtube-play"></i>':
            '<i class="icon-picture"></i>';
        title += '<strong>' + this.get('title') + '</strong>';
        if (this.get('body') && this.get('body') !== '')
          title += ': ' + _.str.prune(this.get('body'), 100);
      } else {
        title += '<strong>' + this.get('name') + '</strong>, '
            + this.get('country');
      }
      return title;
    },

  });
});
