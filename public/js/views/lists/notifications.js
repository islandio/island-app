/*
 * Notification List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'Spin',
  'text!../../../templates/lists/notifications.html',
  'collections/notifications',
  'views/rows/notification'
], function ($, _, List, mps, rest, Spin, template, Collection, Row) {
  return List.extend({

    el: '.panel-content',

    initialize: function (app, options) {
      this.fetching = false;
      this.nomore = false;
      this.limit = 5;
      this.template = _.template(template);
      this.collection = new Collection();
      this.Row = Row;

      List.prototype.initialize.call(this, app, options);

      this.subscriptions = [];

      _.bindAll(this, 'collect', 'read', '_remove');
      this.app.rpc.socket.on('notification.new', this.collect);
      this.app.rpc.socket.on('notification.read', this.read);
      this.app.rpc.socket.on('notification.removed', this._remove);

      $(window).resize(_.debounce(_.bind(this.resize, this), 50));

      this.spin = new Spin($('.notifications-spin', this.$el.parent()));
      this.spin.start();
  
      this.latest_list = this.app.profile.notes || {items: []};
      this.collection.reset(this.latest_list.items);
    },

    collect: function (data) {
      this.collection.unshift(data);
    },

    read: function (data) {
      var view = _.find(this.views, function (v) {
        return v.model.id === data.id;
      });

      if (view) {
        view.update();
        mps.publish('notification/change', []);
      }
    },

    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length > 0) {
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      } else {
        this.nomore = true;
        $('<span class="empty-feed">No notifications.</span>').appendTo(this.$el);
        this.spin.stop();
      }
      this.paginate();
      return this;
    },

    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      mps.publish('notification/change', []);
      _.delay(_.bind(function () {
        this.resize();
        if (pagination !== true) {
          this.checkHeight();
        }
      }, this), 20);
      return this;
    },

    setup: function () {
      this.spin.stop();
      mps.publish('notification/change', []);
      this.$el.parent().addClass('animated');
      $('.container').addClass('animated');
      this.resize();
      List.prototype.setup.call(this);
    },

    destroy: function () {
      this.unpaginate();
      this.app.rpc.socket.removeListener('notification.new', this.collect);
      this.app.rpc.socket.removeListener('notification.read', this.read);
      this.app.rpc.socket.removeListener('notification.removed', this._remove);
      return List.prototype.destroy.call(this);
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
          this.checkHeight();
          mps.publish('notification/change', []);
        }, this));
      }
    },

    // update the panel's height
    resize: function () {
      this.$el.parent().height($(window).height());
    },

    // check the panel's empty space and get more
    // notes to fill it up.
    checkHeight: function () {
      wh = this.$el.parent().height();
      so = this.spin.target.offset().top;
      if (wh - so > this.spin.target.height() / 2) {
        this.more();
      }
    },

    // attempt to get more models (older) from server
    more: function () {

      // render models and handle edge cases
      function updateUI(list) {
        _.defaults(list, {items:[]});
        this.latest_list = list;
        var showingall = $('.list-spin .empty-feed', this.$el.parent());
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          if (this.collection.length > 0) {
            showingall.css('display', 'block');
          } else {
            showingall.hide();
            $('<span class="empty-feed">No notifications.</span>')
                .appendTo(this.$el);
          }
        } else {
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        }
        _.delay(_.bind(function () {
          this.spin.stop();
          this.fetching = false;
          if (list.items.length < this.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible')) {
              showingall.css('display', 'block');
            }
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) {
        return;
      }

      // there are no more, don't call server
      if (this.nomore || !this.latest_list.more) {
        return updateUI.call(this, _.defaults({items:[]}, this.latest_list));
      }

      // get more
      this.spin.start();
      this.fetching = true;
      rest.post('/api/notifications/list', {
        subscriber_id: this.app.profile.member.id,
        limit: this.limit,
        cursor: this.latest_list.cursor,
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.notes);

      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = this.$el.parent();
      var paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2) {
          this.more();
        }
      }, this), 20);
      wrap.scroll(paginate).resize(paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate)
          .unbind('resize', this._paginate);
    }

  });
});
