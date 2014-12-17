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
    
    // el: '.block-messages > ul',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.setElement(options.el);

      if (!options.type) {
        options.type = 'block';
      }

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      if (this.app.profile && this.app.profile.member) {
        this.app.rpc.socket.on(this.app.profile.member.id + '.flash.new',
            _.bind(this.collect, this));
      }

      mps.subscribe('flash/new', _.bind(function (data, clear) {
        if (data.type === this.collection.options.type) {
          if (clear) {
            this.collection.reset([]);
            _.each(this.views, function (v) {
              v.destroy();
            });
            this.views = [];
          }
          this.collection.push(data);
        }
      }, this));

      // Check for existing messages.
      if (this.collection.options.type === 'block') {
        var messages = this.app.profile ? this.app.profile.messages || []: [];
        _.each(messages, _.bind(function (msg) {
          this.collection.push(msg);
        }, this));
      }
    },

    collect: function (data) {
      if (data.type === this.collection.options.type) {
        this.collection.push(data);
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
        }, this));
      }
    },

  });
});
