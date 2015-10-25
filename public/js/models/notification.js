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
      if (att.event.data.action.t === 'comment') {
        var verb = 'commented on';
        var owner;
        if (att.event.data.action.i === att.event.data.target.i) {
          owner = 'their';
          verb = 'also ' + verb;
        } else if (att.subscriber_id === att.event.data.target.i)
          owner = 'your';
        else {
          owner = att.event.data.target.a + '\'s';
          verb = 'also ' + verb;
        }
        var str = '<strong>' + att.event.data.action.a + '</strong> '
            + verb + ' <strong>'
            + owner + '</strong> ';
        if (att.event.data.target.t === 'post') {
          str += 'post';
        } else if (att.event.data.target.t === 'tick') {
          str += 'effort on';
        }
        return str + (att.event.data.target.n !== '' ? ' <strong>'
          + att.event.data.target.n + '</strong>': '')
          + ': "' + att.event.data.action.b
          + '".';
      } else if (att.event.data.action.t === 'hangten') {
        var str = '<strong>' + att.event.data.action.a + '</strong> '
              + 'gave you a nod for ';
        if (att.event.data.target.t === 'post') {
          str += 'your post';
        } else if (att.event.data.target.t === 'tick') {
          str += 'your effort on';
        } else if (att.event.data.target.t === 'crag') {
          str += 'adding the crag';
        } else if (att.event.data.target.t === 'ascent') {
          str += 'adding the ' + (att.event.data.target.pt === 'b' ?
              'boulder problem': 'route');
        }
        return str + (att.event.data.target.n !== '' ? ' <strong>'
              + att.event.data.target.n + '</strong>': '')
              + (att.event.data.target.l ? ' in ' + att.event.data.target.l: '')
              + '.';
      } else if (att.event.data.action.t === 'request') {
        return '<strong>' + att.event.data.action.a + '</strong> '
            + 'wants to follow you.';
      } else if (att.event.data.action.t === 'accept') {
        return 'You are now following <strong>'
            + att.event.data.action.a + '</strong>';
      } else if (att.event.data.action.t === 'follow') {
        return '<strong>' + att.event.data.action.a + '</strong> '
            + 'is now following you.';
      } else if (att.event.data.action.t === 'mention') {
        return '<strong>' + att.event.data.action.a + '</strong> '
            + 'mentioned you in their post.';
      } else {
        return '';
      }
    }

  });
});
