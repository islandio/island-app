/*
 * Comment model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function () {
      var name = '<a href="/' + this.get('author').username
          + '" class="comment-author navigate">'
          + this.get('author').displayName + '</a> ';
 
      // Replace @mentions with links to users:
      var body = this.get('body')
          .replace(/\u0091@(.*?)\u0092/g, function(m, p1) {
        return '<strong><a href="/' + p1 + '" class="title">'
            + '@' + p1 + '</a></strong>';
      });
 
      return util.formatText(name + body);
    },

  });
});
