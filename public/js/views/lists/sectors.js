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
  'text!../../../templates/lists/sectors.html',
  'views/rows/sector'
], function ($, _, List, mps, rest, util, template, Row) {
  return List.extend({

    el: '.sidebar-sectors',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;

      List.prototype.initialize.call(this, app, options);

      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('sector.new', this.collect);
      this.app.rpc.socket.on('sector.removed', this._remove);

      if (!this.app.profile.content.sectors) {
        return;
      }

      this.collection.reset(this.app.profile.content.sectors.items);
    },

    setup: function () {
      this.count = this.$('.sidebar-heading-cnt');
      this.tip = this.$('.sidebar-tip');

      this.updateCount();
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.app.rpc.socket.removeListener('sector.new', this.collect);
      this.app.rpc.socket.removeListener('sector.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (data.parent_id === this.parentView.model.id) {
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
      if (this.collection.length === 0) {
        this.tip.show();
      } else {
        this.tip.hide();
      }
      this.count.text('(' + this.collection.length + ')');
    },

  });
});
