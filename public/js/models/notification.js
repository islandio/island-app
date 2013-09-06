/*
 * Notification model
 */

define([
  'Underscore',
  'Backbone',
  'util'
], function (_, Backbone, util) {
  return Backbone.Model.extend({

    body: function () {
      var att = this.attributes;
      var owner;
      var preverb = '';
      if (att.event.data.action.i === att.event.data.target.i) {
        owner = 'their';
        preverb = 'also ';
      } else if (att.subscriber_id === att.event.data.target.i)
        owner = 'your';
      else {
        owner = att.event.data.target.a + '\'s';
        preverb = 'also ';
      }

      if (att.event.data.action.t === 'comment') {
        var verb = preverb + 'commented on';
        return '<strong>' + att.event.data.action.a + '</strong> '
            + verb + ' <strong>'
            + owner + '</strong> '
            + att.event.data.target.t
            + (att.event.data.target.n !== '' ? ' <strong>'
            + att.event.data.target.n + '</strong>': '')
            + ': "' + att.event.data.action.b
            + '".';
      } else return '';
    }

  });
});
