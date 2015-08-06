/*
 * Sidebar List view.
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/ticks.html',
  'collections/ticks',
  'views/rows/tick.compact'
], function ($, _, List, mps, rest, util, template, Collection, Row) {
  return List.extend({

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection();
      this.Row = Row;
      this.type = options.type;
      this.subtype = options.subtype;
      this.heading = options.heading;
      this.setElement(options.parentView.$('.sidebar-' + this.type + 's' +
          (options.subtype ? '-' + options.subtype: '')));

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('tick.new', this.collect);
      this.app.rpc.socket.on('tick.removed', this._remove);

      // Reset the collection.
      var items = _.filter(this.app.profile.content.ticks.items,
          _.bind(function (i) {
        return i.type === this.subtype;
      }, this));
      items.sort(function (a, b) {
        return (new Date(b.date)).valueOf() - (new Date(a.date)).valueOf();
      });
      this.collection.reset(items);
    },

    setup: function () {
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.app.rpc.socket.removeListener('tick.new', this.collect);
      this.app.rpc.socket.removeListener('tick.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      if (data.sent && data.type === this.type && data.public !== false) {
        this.collection.unshift(data);
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
        } else {
          view._remove(_.bind(function () {
            this.collection.remove(view.model);
          }, this));
        }
      }
    },

  });
});
