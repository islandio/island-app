/*
 * Profile model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    description: function () {
      var str = this.get('description');
      if (!str || str.trim() === '') return '<p>...</p>';
      else return util.formatText(str);
    }

  });
});
