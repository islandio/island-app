/*
 * Flash Messages List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/flashes.html',
  'collections/flashes',
  'views/rows/flash'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '.block-messages > ul',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      if (this.app.profile && this.app.profile.member) {
        this.app.rpc.socket.on(this.app.profile.member.id + '.flash.new',
            _.bind(this.collect, this));
      }

      mps.subscribe('flash/new', _.bind(function (data, clear) {
        if (clear) {
          this.collection.reset([]);
          _.each(this.views, function (v) {
            v.destroy();
          });
          this.views = [];
        }
        this.collection.push(data);
      }, this));

      // Call super init.
      List.prototype.initialize.call(this, app, options);
    },

    collect: function (data) {
      this.collection.push(data);
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
        }, this));
      }
    },

  });
});

David Sjöquist as LORD SHARKFIST
Christine Sjöquist as LAYDEE SHARKFIST
Sander Pick as OTHER FUCKING GUY
