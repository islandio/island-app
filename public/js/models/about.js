/*
 * About model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    initialize: function () {},

    formatText: function (txt, breaks, prune) {
      txt = util.formatText(txt, breaks);

      // Replace @mentions with links to users:
      txt = txt.replace(/\u0091@(.*?)\u0092/g, function(m, p1) {
        return '<strong><a href="/' + p1 + '" class="title">' +
            '@' + p1 + '</a></strong>';
      });
      return prune ? _.str.prune(txt, prune) : txt;
    }

  });
});
