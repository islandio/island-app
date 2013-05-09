/*
 * Post model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/posts/',

    date: function () {
      var date = new Date(this.get('created'));
      return date.format('mmm d');
    },

    body: function () {
      return util.blurb(util.formatText(this.get('body')), 500);
    },

  });
});