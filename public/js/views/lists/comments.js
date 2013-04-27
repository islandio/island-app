/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Shell subscriptions:
      this.subscriptions = [
        mps.subscribe('comment/new', _.bind(this.collect, this)),
        mps.subscribe('market/transaction/new', _.bind(this.collect, this)),
      ];

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Reset the collection with the appropriate list.
      var items = this.app.profile.get('page').comments ?
                  this.app.profile.get('page').comments.items : [];
      this.collection.reset(items);
    },

    // Handle bus events from subscription.
    collect: function (data) {
      var id = this.app.profile.get('page').shell.idea ?
               this.app.profile.get('page').shell.idea.id:
               this.app.profile.get('page').shell.campaign.id;
      if (id === data.parent_id)
        this.collection.unshift(data);
    },

  });
});
