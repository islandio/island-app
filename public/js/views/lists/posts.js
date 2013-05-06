/*
 * Posts List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/posts.html',
  'collections/posts',
  'views/rows/post'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#posts',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Shell subscriptions:
      // this.subscriptions = [
      //   mps.subscribe('comment/new', _.bind(this.collect, this)),
      // ];

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Reset the collection with the appropriate list.
      var items = this.app.profile.get('content').posts ?
                  this.app.profile.get('content').posts.items : [];
      this.collection.reset(items);
    },

    // Handle bus events from subscription.
    collect: function (data) {
      // var id = this.app.profile.get('content').shell.idea ?
      //          this.app.profile.get('content').shell.idea.id:
      //          this.app.profile.get('page').shell.campaign.id;
      // if (id === data.parent_id)
      //   this.collection.unshift(data);
    },

  });
});