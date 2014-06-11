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
  'text!../../../templates/lists/followers.html',
  'views/rows/follower'
], function ($, _, List, mps, rest, util, template, Row) {
  return List.extend({

    el: '.sidebar-followers',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      this.app.rpc.socket.on('follow.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('follow.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.app.profile.content.followers.items);
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
      this.app.rpc.socket.removeAllListeners('follow.new');
      this.app.rpc.socket.removeAllListeners('follow.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (data.subscribee.id === this.app.profile.member.id) {
        if (!this.app.profile.content.private) {
          this.collection.unshift(data);
        }
        this.updateCount();
      }
    },

    _remove: function (data) {
      if (this.app.profile.content.private) {
        this.updateCount();
        return;
      }
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
      if (!this.parentView.model
          || (this.app.profile.member
          && this.parentView.model.id === this.app.profile.member.id)) {
        if (this.collection.length === 0) {
          this.tip.show();
        } else {
          this.tip.hide();
        }
      }
      this.count.text('(' + this.collection.length + ')');
    },

  });
});
