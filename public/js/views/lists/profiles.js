/*
 * Profiles List view
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/profiles.html',
  'collections/profiles',
  'views/rows/profile',
  'Spin'
], function ($, _, Modernizr, List, mps, rpc, util, template,
      Collection, Row, Spin) {
  return List.extend({

    el: '#profiles',

    fetching: false,
    nomore: false,
    limit: 5,
    attachments: [],

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('#profiles_spin', this.parentView.el));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.socket.subscribe('profiles')
          .bind('profile.new', _.bind(this.collect, this))
          .bind('profile.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = this.app.profile.content.page
          && this.app.profile.content.page.role === 0 ? 'No followers.': '';

      // Reset the collection.
      this.latest_list = this.app.profile.content.profiles;
      this.collection.reset(this.latest_list.items);
    },

    // collect new profiles from socket events.
    collect: function (mem) {
      this.collection.unshift(mem);
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
        $('<span class="empty-feed">' + this.empty_label
            + '</span>').appendTo(this.$el);
        this.spin.stop();
      }
      this.paginate();
      return this;
    },

    // render the latest model
    // (could be newly arived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      _.delay(_.bind(function () {
        if (pagination !== true)
          this.checkHeight();
      }, this), 60);
      return this;
    },

    // handle mouse events.
    events: {},

    // misc. setup
    setup: function () {
      return List.prototype.setup.call(this);
    },

    destroy: function () {
      this.unpaginate();
      return List.prototype.destroy.call(this);
    },

    // remove a model
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
          this.checkHeight();
        }, this));
      }
    },

    // check the panel's empty space and get more
    // notes to fill it up.
    checkHeight: function () {
      wh = $(window).height();
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
          var showingall = this.parentView.$('.list-spin .empty-feed');
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            $('<span class="empty-feed">' + this.empty_label + '</span>')
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
      rpc.post('/api/members/list', {
        limit: this.limit,
        cursor: this.latest_list.cursor,
        query: this.latest_list.query,
        sort: this.latest_list.sort
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.profiles);

      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = $(window);
      var paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() + this.$el.offset().top
            - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);

      wrap.scroll(paginate).resize(paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll');
    }

  });
});
