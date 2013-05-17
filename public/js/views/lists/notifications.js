/*
 * Notification List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'text!../../../templates/lists/notifications.html',
  'collections/notifications',
  'views/rows/notification',
  'Spin'
], function ($, _, List, mps, rpc, template, Collection, Row, Spin) {
  return List.extend({

    el: '#panel_content',

    fetching: false,
    nomore: false,
    limit: 5,

    // misc. init
    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket Subscriptions
      this.channel = this.app.socket.subscribe('mem-'
          + this.app.profile.get('member').key);
      this.channel.bind('notification.new', _.bind(this.collect, this));
      this.channel.bind('notification.read', _.bind(this.read, this));
      this.channel.bind('notification.removed', _.bind(this._remove, this));

      // Shell events
      $(window).resize(_.debounce(_.bind(this.resize, this), 50));

      // Init the load indicator.
      this.spin = new Spin($('#notifications-spin', this.$el.parent()));
      this.spin.start();
  
      // Reset the collection.
      this.latest_list = this.app.profile.get('content').notes;
      this.collection.reset(this.latest_list.items);
    },

    // receive note from event bus
    collect: function (data) {
      this.collection.unshift(data);
    },

    // receive update from event bus
    read: function (data) {
      var view = _.find(this.views, function (v) {
        return v.model.id === data.id;
      });

      if (view) {
        view.update();
        // mps.publish('notification/change', []);
      }
    },

    // receive update from event bus
    _remove: function (data) {
      var view = _.find(this.views, function (v) {
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(this.collection.indexOf(view.model), 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
          this.checkHeight();
        }, this));
        // mps.publish('notification/change', []);
      }
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length > 0)
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      else {
        this.nomore = true;
        $('<span class="empty-feed">No notifications.</span>').appendTo(this.$el);
      }
      this.paginate();
      return this;
    },

    // render the latest model
    // (could be newly arived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      mps.publish('notification/change', []);
      _.delay(_.bind(function () {
        this.resize();
        if (pagination !== true)
          this.checkHeight();
      }, this), 60);
      return this;
    },

    // misc. setup
    setup: function () {
      this.spin.stop();
      mps.publish('notification/change', []);
      this.$el.parent().addClass('animated');
      $('#wrap').addClass('animated');
      this.resize();
      List.prototype.setup.call(this);
    },

    destroy: function () {
      var panel = $('#panel');
      var wrap = $('#wrap');
      wrap.removeClass('panel-open');
      panel.removeClass('open');
      store.set('isNotesOpen', false);
      List.prototype.destroy.call(this);
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
      if (wh - so > this.spin.target.height() / 2)
        this.more();
    },

    // attempt to get more models (older) from server
    more: function () {
      // render models and handle edge cases
      function updateUI(list) {
        _.defaults(list, {items:[]});
        this.latest_list = list;
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          var showingall = $('.list-spin .empty-feed', this.$el.parent());
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            $('<span class="empty-feed">No notifications.</span>')
                .appendTo(this.$el);
          }
        } else
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        _.delay(_.bind(function () {
          this.spin.stop();
          this.fetching = false;
          if (list.items.length < this.limit) {
            this.spin.target.hide();
            $('.list-spin .empty-feed', this.$el.parent())
                .css('display', 'block');
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) return;

      // there are no more, don't call server
      if (this.nomore || !this.latest_list.more)
        return updateUI.call(this, _.defaults({items:[]}, this.latest_list));

      // get more
      this.spin.start();
      this.fetching = true;
      rpc.post('/api/notifications', {
        subscriber_id: this.app.profile.get('member').id,
        limit: this.limit,
        cursor: this.latest_list.cursor,
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.posts);

      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = this.$el.parent();
      var paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);
      wrap.scroll(paginate).resize(paginate);
    },

  });
});
