/*
 * Notification model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/notifications/',

    body: function () {
      var att = this.attributes;
      if (att.event.data.action.t === 'comment') {
        var verb = 'commented on';
        return '<strong>' + att.event.data.action.a + '</strong> '
            + verb + ' <strong>'
            + att.event.data.target.a + ' \'s</strong> '
            + att.event.data.target.t
            + ': "</strong>' + util.blurb(att.event.data.action.b.trim(), 20)
            + '"</strong>.';
      } else return '';
    }

  });
});
