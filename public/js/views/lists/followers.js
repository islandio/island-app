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
      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('follow.new', this.collect);
      this.app.rpc.socket.on('follow.removed', this._remove);

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
      this.app.rpc.socket.removeListener('follow.new', this.collect);
      this.app.rpc.socket.removeListener('follow.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      var id = this.parentView.model ? this.parentView.model.id:
          this.app.profile.member.id;
      if (data.subscribee.id === id) {
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
        if (this.app.profile.content.private) {
          view.destroy();
          this.collection.remove(view.model);
          this.updateCount();
        } else {
          view._remove(_.bind(function () {
            this.collection.remove(view.model);
            this.updateCount();
          }, this));
        }
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
