/*
 * Medias List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../../templates/lists/medias.html',
  'collections/medias',
  'views/rows/media'
], function ($, _, List, mps, rest, util, Spin, template, Collection, Row) {
  return List.extend({

    el: '.events',

    fetching: false,
    nomore: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection();
      this.Row = Row;

      List.prototype.initialize.call(this, app, options);

      this.spin = new Spin($('.events-spin', this.$el.parent()));
      this.spin.start();

      this.subscriptions = [];

      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('media.new', this.collect);
      this.app.rpc.socket.on('media.removed', this._remove);

      this.latestList = this.app.profile.content.medias;
      _.each(this.latestList.items, function (i) {
        i.path = i.parent_type === 'post' ? i.parent.key: 'efforts/' +
            i.parent.key;
      });
      this.collection.reset(this.latestList.items);
    },

    // receive event from event bus
    collect: function (data) {
      return;
      // if (!_.contains(this.latestList.actions, data.action_type)) {
      //   return;
      // }
      // if (this.latestList.query) {
      //   if (this.latestList.query.subscribee_id &&
      //       data.actor_id !== this.latestList.query.subscribee_id &&
      //       data.target_id !== this.latestList.query.subscribee_id) {
      //     return;
      //   }
      //   if (this.latestList.query.action) {
      //     if (data.action_type !== this.latestList.query.action.type) {
      //       return;
      //     }
      //     var valid = true;
      //     _.each(this.latestList.query.action.query, function (v, p) {
      //       if (v.$ne !== undefined) {
      //         v = !v.$ne;
      //         if (!!data.action[p] !== v) {
      //           valid = false;
      //         }
      //       } else if (data.action[p] !== v) {
      //         valid = false;
      //       }
      //     });
      //     if (!valid) return;
      //   }
      // }
      // this.collection.unshift(data);
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      this.spin.stop();
      if (this.latestList.more) {
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      } else {
        this.nomore = true;
        this.listSpin.hide();
        $('<span class="empty-feed">Nothing to see here yet.</span>')
            .appendTo(this.$el);
        this.spin.stop();
        this.spin.target.hide();
      }
      this.paginate();
      return this;
    },

    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);
      _.delay(_.bind(function () {
        if (pagination !== true) {
          this.checkHeight();
        }
      }, this), 20);
      return this;
    },

    events: {
      'click .events-filter .subtab': 'filter'
    },

    setup: function () {
      this.footer = this.$('.list-footer');
      this.listSpin = this.parentView.$('.list-spin');
      this.showingAll = this.parentView.$('.list-spin .empty-feed');

      return List.prototype.setup.call(this);
    },

    destroy: function () {
      this.unpaginate();
      this.app.rpc.socket.removeListener('media.new', this.collect);
      this.app.rpc.socket.removeListener('media.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    // remove a model
    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.collection.remove(view.model);
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.checkHeight();
        }, this));
      }
    },

    // check the panel's empty space and get more
    // notes to fill it up.
    checkHeight: function () {
      wh = $(window).height();
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
        this.latestList = list;
        if (!list.more) {
          this.nomore = true;
          this.fetching = false;
          this.spin.stop();
          this.spin.target.hide();
          if (this.collection.length > 0) {
            this.showingAll.css('display', 'block');
          } else {
            this.showingAll.hide();
            this.listSpin.hide();
            if (this.$('.empty-feed').length === 0) {
              $('<span class="empty-feed">Nothing to see here yet.</span>')
                  .appendTo(this.$el);
            }
          }
        } else {
          _.each(list.items, _.bind(function (i,o) {
            i.path = i.parent_type === 'post' ? i.parent.key: 'efforts/' +
                i.parent.key;
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        }

        _.delay(_.bind(function () {
          this.fetching = false;
          this.spin.stop();
          if (list.items.length < this.latestList.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible')) {
              this.showingAll.css('display', 'block');
            }
          } else {
            this.showingAll.hide();
            this.spin.target.show();
          }
          window.dispatchEvent(new Event('resize'));
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) {
        return;
      }

      // Show spin region.
      this.listSpin.show();

      // there are no more, don't call server
      if (this.nomore || !this.latestList.more) {
        return updateUI.call(this, _.defaults({items:[]}, this.latestList));
      }

      // get more
      this.spin.start();
      this.fetching = true;
      rest.post('/api/medias/list', {
        limit: this.latestList.limit,
        cursor: this.latestList.cursor,
        actions: this.latestList.actions,
        query: this.latestList.query,
        // media: true
      }, _.bind(function (err, data) {
        if (err) {
          this.spin.stop();
          this.spin.target.hide();
          this.fetching = false;
          return console.error(err.stack);
        }

        updateUI.call(this, data.medias);
      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = $(window);
      this._paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() + this.$el.offset().top -
            wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2) {
          this.more();
        }
      }, this), 20);
      wrap.scroll(this._paginate).resize(this._paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate).unbind('resize', this._paginate);
    },

    filter: function (e) {
      // e.preventDefault();

      // // Update buttons.
      // var chosen = $(e.target).closest('li');
      // if (chosen.hasClass('active')) return;
      // var active = $('.active', chosen.parent());
      // chosen.addClass('active');
      // active.removeClass('active');

      // // Update list query.
      // switch (chosen.data('filter')) {
      //   case 'all':
      //     this.latestList.actions = this.collection.options.filters;
      //     break;
      //   case 'session':
      //     this.latestList.actions = ['session'];
      //     break;
      //   case 'post':
      //     this.latestList.actions = ['post'];
      //     break;
      //   case 'tick':
      //     this.latestList.actions = ['tick'];
      //     break;
      // }

      // // Set feed state.
      // store.set(this.collection.options.feedStore || 'feed',
      //     {actions: chosen.data('filter')});

      // // Reset the collection.
      // this.nomore = false;
      // this.latestList.cursor = 0;
      // this.latestList.more = true;
      // this.collection.reset([]);
      // _.each(this.views, function (v) {
      //   v.destroy();
      // });
      // this.views = [];
      // this.$('.event-day-header').remove();
      // this.$('.event-divider').remove();
      // this.showingAll.hide();
      // this.more();

      // return false;
    },

  });
});
