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
      else if (this.get('geometry'))
        return 'javascript:;';
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
        title += '<strong>' + this.get('name') + '</strong>';
        if (this.get('sector')) title += ', ' + this.get('sector');
      } else if (this.get('type')) {
        title += this.get('type') === 'video' ?
            '<i class="icon-youtube-play"></i>':
            '<i class="icon-picture"></i>';
        title += '<strong>' + this.get('title') + '</strong>';
        if (this.get('body') && this.get('body') !== '')
          title += ': ' + _.str.prune(this.get('body'), 100);
      } else if (this.get('geometry')) {
        title += '<i class="icon-location"></i>'
            + this.get('formatted_address');
      } else {
        title += '<strong>' + this.get('name') + '</strong>, '
            + this.get('country');
      }
      return title;
    },

    term: function () {
      var term = '';
      if (this.get('username')) {
        term += this.get('username');
        if (this.get('displayName') && this.get('displayName') !== '')
          term += ' (' + this.get('displayName') + ')';
      } else if (this.get('crag')) {
        term += this.get('name');
      } else if (this.get('type')) {
        term += this.get('title');
      } else if (this.get('geometry')) {
        term += this.get('formatted_address');
      } else {
        term += this.get('name');
      }
      return term;
    },

  });
});
