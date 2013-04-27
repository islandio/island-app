/*
 * Notification model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    getNote: function () {
      var att = this.attributes;
      var parts = this.get('msg_parts');
      if ('commented on' === parts.action) {
        return '<strong>' + parts.actor + '</strong> '
            + parts.action.toLowerCase() + ' <strong>'
            + util.blurb(parts.about, 80) + '</strong>';
            + ': "</strong>' + util.blurb(parts.content.trim(), 80)
            + '"</strong>.';
      } else if ('invested' === parts.action) {
        return '<strong>' + parts.actor + '</strong> '
            + parts.action.toLowerCase() + ' '
            + '<em>' + parts.amount + ' hylo</em> in '
            + '<strong>' + util.blurb(parts.about, 80) + '</strong>.';
      } else if ('pledged' === parts.action) {
        return '<strong>' + parts.actor + '</strong> '
            + parts.action.toLowerCase() + ' '
            + '<em>$' + util.addCommas((parts.amount).toFixed(2))
            + '</em> to '
            + '<strong>' + util.blurb(parts.about, 80)
            + '</strong>.';
      } else if ('unlocked crowdfunding' === parts.action) {
        return '<strong>' + parts.owner + '\'s' + '</strong> ' + 'idea, '
            + '<strong>' + util.blurb(parts.about, 80) + '</strong>, '
            + parts.action.toLowerCase() + '.';
      } else if ('started a new crowdfunding campaign' === parts.action) {
        return '<strong>' + parts.owner + '</strong> '
            + parts.action.toLowerCase()
            + ': "</strong>' + util.blurb(parts.about, 80)
            + '"</strong>.';
      } else return '';
    }

  });
});
