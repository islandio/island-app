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
  'text!../../../templates/lists/followees.html',
  'views/rows/followee'
], function ($, _, List, mps, rest, util, template, Row) {
  return List.extend({

    el: '.sidebar-followees',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;

      // Call super init
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('follow.new', this.collect);
      this.app.rpc.socket.on('follow.removed', this._remove);

      // Reset the collection.
      this.latestList = this.app.profile.content.followees;
      this.collection.count = this.latestList.count;
      this.collection.more = this.collection.count - this.latestList.items.length;
      this.collection.reset(this.latestList.items);
    },

    setup: function () {
      this.count = this.$('.sidebar-heading-cnt');
      this.tip = this.$('.sidebar-tip');
      this.footer = this.$('.sidebar-more');
      if (this.footer.length === 0) {
        delete this.footer;
      }

      if (this.collection.count === this.collection.length) {
        this.footer.hide();
      }

      this.updateCount();
      return List.prototype.setup.call(this);
    },

    events: {
      'click .sidebar-more': 'more'
    },

    destroy: function () {
      this.app.rpc.socket.removeListener('follow.new', this.collect);
      this.app.rpc.socket.removeListener('follow.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      var id = this.parentView.model ? this.parentView.model.id:
          this.app.profile.member.id;
      if (data.subscriber.id === id) {
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
      if (!this.parentView.model ||
          (this.app.profile.member &&
          this.parentView.model.id === this.app.profile.member.id)) {
        if (this.collection.length === 0) {
          this.tip.show();
        } else {
          this.tip.hide();
        }
      }
      this.count.text('(' + this.collection.count + ')');
    },

    more: function (e) {
      var limit = this.collection.more;
      this.collection.more = 0;

      rest.post('/api/subscriptions/list', {
        skip: this.collection.length,
        limit: limit,
        query: this.latestList.query
      }, _.bind(function (err, data) {
        if (err) return console.log(err);

        var ids = _.pluck(this.collection.models, 'id');
        var i = 0;
        this.collection.options.reverse = false;
        _.each(data.subscriptions.items, _.bind(function (c) {
          if (!_.contains(ids, c.id)) {
            this.collection.push(c);
            ++i;
          }
        }, this));
        this.collection.options.reverse = true;

        this.footer.hide();
      }, this));
    },

  });
});
