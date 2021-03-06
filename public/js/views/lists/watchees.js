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
      this.setElement(options.parentView.$('.sidebar-' + this.type + 's' +
          (options.subtype ? '-' + options.subtype: '')));

      List.prototype.initialize.call(this, app, options);

      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('watch.new', this.collect);
      this.app.rpc.socket.on('watch.removed', this._remove);

      if (!this.app.profile.content.watchees) {
        return;
      }

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
      this.app.rpc.socket.removeListener('watch.new', this.collect);
      this.app.rpc.socket.removeListener('watch.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      var id = this.parentView.model ? this.parentView.model.id:
          this.app.profile.member.id;
      if (data.subscriber.id === id && data.meta.type === this.type) {
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
