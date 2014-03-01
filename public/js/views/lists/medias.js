/*
 * Medias List view
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../../templates/lists/medias.html',
  'collections/medias',
  'views/rows/media'
], function ($, _, Modernizr, List, mps, rest, util, Spin, template, Collection, Row) {
  return List.extend({

    el: '.medias',

    fetching: false,
    nomore: false,
    limit: 3,
    adding: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.type = options.type;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.medias-spin', this.parentView.el));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('media.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('media.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = this.app.profile.content.page ? 'No media.': '';

      // Reset the collection.
      this.latest_list = this.app.profile.content.medias;
      this.collection.reset(this.latest_list.items);
    },

    // collect new data from socket events.
    collect: function (data) {
      if (data[this.type + '_id'] === this.parentView.model.id)
        this.collection.unshift(data);
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
      }, this), 20);
      return this;
    },

    events: {
      
    },

    // misc. setup
    setup: function () {

      // Save refs
      this.mediaForm = this.$('.media-input form');
      this.mediaButton = this.$('.media-button', this.mediaForm);

      // Show add media input.
      this.$('.media-input .media').show();

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.$('input, textarea').placeholder();

      // Submit media.
      this.mediaButton.click(_.bind(this.submit, this));

      // Init the load indicator for the button.
      this.mediaButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#4d4d4d',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6
      });

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

    submit: function (e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (this.adding) return false;

      // Grab payload.
      var payload = {};
      payload.video = util.cleanObject(this.mediaForm.serializeObject());
      payload.video = util.parseVideoURL(payload.video.link);

      // Check for empty payload.
      if (!payload.video) {
        mps.publish('flash/new', [{
          message: 'Invalid link. Please use a YouTube or Vimeo URL.',
          level: 'error',
          sticky: false
        }, true]);
        $('input[name="link"]', this.mediaForm).val('');
        return false;
      }
      this.adding = true;

      // Add the parent id.
      payload[this.type + '_id'] = this.parentView.model.id;

      // Show loading.
      this.mediaButtonSpin.start();
      this.mediaButton.addClass('spinning');
      this.mediaButton.addClass('disabled');
      this.mediaButton.attr('disabled', 'disabled');

      // Now save the media to server.
      rest.post('/api/medias/' + this.type, payload,
          _.bind(function (err, data) {

        // Clear fields.
        $('input[name="link"]', this.mediaForm).val('');

        // Hide loading.
        this.mediaButtonSpin.stop();
        this.mediaButton.removeClass('spinning');
        this.mediaButton.removeClass('disabled');
        this.mediaButton.attr('disabled', false);
        this.adding = false;

        if (err) return console.log(err);

        // Update map media.
        mps.publish('map/refresh');

      }, this));

      return false;
    },

    // Check the panel's empty space and get more
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
        var showingall = this.parentView.$('.list-spin .empty-feed');
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
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
            if (!this.$('.empty-feed').is(':visible'))
              showingall.css('display', 'block');
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
      rest.post('/api/medias/list', {
        limit: this.limit,
        cursor: this.latest_list.cursor,
        query: this.latest_list.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.medias);

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
      }, this), 20);

      wrap.scroll(paginate).resize(paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate)
          .unbind('resize', this._paginate);
    }

  });
});
