/*
 * Notification model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/notifications/',

    getNote: function () {
      var att = this.attributes;
      if (att.event.data.a === 'commented on')
        return '<strong>' + att.event.data.m + '</strong> '
            + att.event.data.a + ' <strong>'
            + util.blurb(att.event.data.k, 80) + '</strong>'
            + ': "</strong>' + util.blurb(att.event.data.b.trim(), 80)
            + '"</strong>.';
      else return '';
    }

  });
});
