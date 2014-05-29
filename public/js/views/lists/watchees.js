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
  'text!../../../templates/lists/watchees.html',
  'views/rows/watchee'
], function ($, _, List, mps, rest, util, template, Row) {
  return List.extend({

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;
      this.type = options.type;
      this.subtype = options.subtype;
      this.heading = options.heading;
      this.setElement(options.parentView.$('.sidebar-' + this.type + 's'
          + (options.subtype ? '-' + options.subtype: '')));

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      this.app.rpc.socket.on('watch.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('watch.removed', _.bind(this._remove, this));

      // Reset the collection.
      var items = _.filter(this.app.profile.content.watchees.items,
          _.bind(function (i) {
        if (this.type === 'crag') {
          return !i.subscribee.type;
        } else {
          return i.subscribee.type === this.subtype;
        }
      }, this));
      this.collection.reset(items);
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
      this.app.rpc.socket.removeAllListeners('watch.new');
      this.app.rpc.socket.removeAllListeners('watch.removed');
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      console.log(data)
      if (data.subscriber.id === this.app.profile.member.id && data.meta.type === this.type) {
        if (data.subscribee.type === this.subtype) {
          this.collection.unshift(data);
          this.updateCount();
        }
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
