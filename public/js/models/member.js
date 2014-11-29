/*
 * Member model
 */

define([
  'Backbone',
  'Underscore',
  'util'
], function (Backbone, _, util) {
  return Backbone.Model.extend({

    description: function () {
      var str = this.get('description');
      if (!str || str.trim() === '') {
        return null;
      } else {
        return util.formatText(str);
      }
    },

    anonName: function () {
      var parts = this.get('displayName').split(' ');
      return parts.length > 1 ?
          [_.first(parts), _.last(parts).substr(0, 1) + '.'].join(' '):
          _.first(parts);
    }

  });
});
