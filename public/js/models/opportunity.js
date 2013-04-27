/*
 * Opportunity model
 */

define([
  'Backbone',
  'util',
  'config'
], function (Backbone, util, config) {
  return Backbone.Model.extend({

    _path: 'opportunity',
    _type: 'opportunity',

    description: function () {
      return util.formatText(this.get('description'));
    },

    // hack
    getPerson: function () {
      return config.getPerson();
    },

  });
});
