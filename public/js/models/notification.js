/*
 * Notification model
 */

define([
  'Underscore',
  'Backbone',
], function (_, Backbone) {
  return Backbone.Model.extend({

    body: function () {
      var att = this.attributes;
      var str;
      var owner;
      if (att.event.data.action.t === 'comment') {
        var verb = 'commented on';
        if (att.event.data.action.i === att.event.data.target.i) {
          owner = 'their';
          verb = 'also ' + verb;
        } else if (att.subscriber_id === att.event.data.target.i)
          owner = 'your';
        else {
          owner = '<strong>' + att.event.data.target.a + '\'s </strong>';
          verb = 'also ' + verb;
        }
        str = '<strong>' + att.event.data.action.a + '</strong> ' +
            verb + ' ' + owner + ' ';
        if (att.event.data.target.t === 'post') {
          str += 'post';
        } else if (att.event.data.target.t === 'tick') {
          str += 'effort on';
        }
        return str + (att.event.data.target.n !== '' ? ' <strong>' +
          att.event.data.target.n + '</strong>': '') +
          ': "' + att.event.data.action.b +
          '".';
      } else if (att.event.data.action.t === 'hangten') {
        str = '<strong>' + att.event.data.action.a + '</strong> ' +
              'gave you a bump for ';
        if (att.event.data.target.t === 'post') {
          str += 'your post';
        } else if (att.event.data.target.t === 'tick') {
          str += 'your effort on';
        } else if (att.event.data.target.t === 'crag') {
          if (att.event.data.target.pn) {
            str += 'adding the sector';
          } else {
            str += 'adding the crag';
          }
        } else if (att.event.data.target.t === 'ascent') {
          str += 'adding the ' + (att.event.data.target.pt === 'b' ?
              'boulder problem': 'route');
        }
        return str + (att.event.data.target.n !== '' ? ' <strong>' +
              att.event.data.target.n + '</strong>': '') +
              (att.event.data.target.pn ? ' in ' + att.event.data.target.pn:
              (att.event.data.target.l ? ' in ' + att.event.data.target.l: '')) +
              '.';
      } else if (att.event.data.action.t === 'request') {
        return '<strong>' + att.event.data.action.a + '</strong> ' +
            'wants to follow you.';
      } else if (att.event.data.action.t === 'accept') {
        return 'You are now following <strong>' +
            att.event.data.action.a + '</strong>';
      } else if (att.event.data.action.t === 'follow') {
        return '<strong>' + att.event.data.action.a + '</strong> ' +
            'is now following you.';
      } else if (att.event.data.action.t === 'mention') {
        if (att.event.data.action.i === att.event.data.target.i) {
          owner = 'their ';
        } else if (att.subscriber_id === att.event.data.target.i)
          owner = 'your ';
        else {
          owner = '<strong>' + att.event.data.target.a + '\'s </strong> ';
        }
        str = '<strong>' + att.event.data.action.a + '</strong> ' +
            'mentioned you ';
        if (att.event.data.target.t === 'post') {
          str += 'in ' + owner + 'post.';
        } else if (att.event.data.target.t === 'tick') {
          str += 'in ' + owner + 'effort on' +
              (att.event.data.target.n !== '' ?
                  ' <strong>' + att.event.data.target.n : '') +
              (att.event.data.target.l ? ', ' + att.event.data.target.l : '') +
              '</strong>.';
        } else if (att.event.data.target.t === 'crag') {
          str += 'on the page for <strong>' + att.event.data.target.n +
              '</strong>.';
        } else if (att.event.data.target.t === 'ascent') {
          str += 'on the page for <strong>' + att.event.data.target.n +
              '</strong>.';
        }
        return str;
      } else {
        return '';
      }
    }

  });
});
