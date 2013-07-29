/*
 * Member model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/members/',

    desc: function () {
      return util.formatText(this.get('description'));
    }

  });
});
