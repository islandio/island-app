/*
 * Sidebar List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/watchers.html',
  'views/rows/watcher'
], function ($, _, List, mps, rest, util, template, Row) {
  return List.extend({

    el: '.sidebar-watchers',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      this.app.rpc.socket.on('watch.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('watch.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.watchers.items);
    },

    setup: function () {

      // Save refs.
      this.count = this.$('.sidebar-heading-cnt');
      this.tip = this.$('.sidebar-tip');

      this.updateCount();
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      // this.app.rpc.socket.removeAllListeners('watch.new');
      // this.app.rpc.socket.removeAllListeners('watch.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (data.subscribee.id === this.parentView.model.id) {
        this.collection.unshift(data);
        this.updateCount();
      }
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          this.updateCount();
        }, this));
      }
    },

    updateCount: function () {
      this.count.text('(' + this.collection.length + ')');
    },

  });
});
