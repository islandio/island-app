/*
 * Posts List view
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/posts.html',
  'collections/posts',
  'views/rows/post',
  'Spin'
], function ($, _, Modernizr, List, mps, rpc, util, template,
      Collection, Row, Spin) {
  return List.extend({

    el: '.posts',

    fetching: false,
    nomore: false,
    limit: 3,
    attachments: [],

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.filters = !options || options.filters === undefined ?
          true: options.filters;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.posts-spin', this.parentView.el));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.socket.subscribe('posts')
          .bind('post.new', _.bind(this.collect, this))
          .bind('post.removed', _.bind(this._remove, this));

      // Misc.
      this.empty_label = !this.app.profile.content.page
          || (this.app.profile.content.page
          && this.app.profile.content.page.role !== 1) ? 'No posts.': '';

      // Reset the collection.
      this.latest_list = this.app.profile.content.posts;
      this.collection.reset(this.latest_list.items);
    },

    // collect new posts from socket events.
    collect: function (data) {
      if (!this.latest_list.query)
        this.collection.unshift(data);
      else if (this.latest_list.query.featured)
        return;
      else if (!this.latest_list.query.type
          || this.latest_list.query.type === data.type)
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
        this.spin.target.hide();
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

    events: {
      'focus textarea[name="body"].post-input': 'focus',
      'blur textarea[name="body"].post-input': 'blur',
      'click .feed-button': 'filter',
    },

    // misc. setup
    setup: function () {

      // Save refs
      this.postForm = this.$('.post-input-form');
      this.postBody = $('textarea[name="body"]', this.postForm);
      this.postTitle = this.$('input[name="title"]', this.postForm);
      this.postButton = this.$('.post-button', this.postForm);
      this.dropZone = this.$('.post-dnd');
      this.postParams = this.$('.post-params');
      this.postSelect = this.$('.post-select');
      this.postFiles = this.$('.post-files');

      // Autogrow the write comment box.
      this.postBody.autogrow();

      // Show the write post box if it exists and
      // if the user is not using IE.
      if (navigator.userAgent.indexOf('MSIE') !== -1) {
        this.$('.post-input .post').remove();
        mps.publish('flash/new', [{
          message: 'Island does not support Internet Explorer for posting content.'
              + ' Please use Safari, Chrome, or Firefox.',
          level: 'error',
          sticky: true
        }, true]);
      } else
        this.$('.post-input .post').show();

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.$('input, textarea').placeholder();

      // Add mouse events for dummy file selector.
      var dummy = this.$('.post-file-chooser-dummy');
      this.$('.post-file-chooser').on('mouseover', function (e) {
        dummy.addClass('hover');
      })
      .on('mouseout', function (e) {
        dummy.removeClass('hover');
      })
      .on('mousedown', function (e) {
        dummy.addClass('active');
      })
      .change(_.bind(this.drop, this));
      $(document).on('mouseup', function (e) {
        dummy.removeClass('active');
      });

      // Drag & drop events.
      this.dropZone.on('dragover', _.bind(this.dragover, this))
          .on('dragleave', _.bind(this.dragout, this))
          .on('drop', _.bind(this.drop, this));

      // Submit post.
      this.postButton.click(_.bind(this.submit, this));

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

    dragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.dropZone.addClass('dragging');
    },

    dragout: function (e) {
      this.dropZone.removeClass('dragging');
    },

    drop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Stop drag styles.
      this.dropZone.removeClass('dragging');
      this.focus();
      this.postBody.focus();

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) return false;

      // We have files to upload.
      var data = e.target.files ? null:
          new FormData(this.postForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      var set = $('<div class="upload-set">');
      var parts = [];
      _.each(files, function (file) {
        parts.push('<div class="upload-progress-wrap"><div class="upload-remove">'
            + '<i class="icon-cancel"></i></div><div '
            + 'class="upload-progress">' + '<span class="upload-label">',
            file.name, '</span><span class="upload-progress-txt">'
            + 'Waiting...</span>', '</div></div>');
        if (data && typeof file === 'object') data.append('file', file);
      });
      this.postFiles.append(set.html(parts.join('')));
      var bar = $('.upload-progress', set);
      var txt = $('.upload-progress-txt', set);
      var attachment = {uploading: true};
      this.attachments.push(attachment);

      // Transloadit options
      var opts = {
        wait: true,
        autoSubmit: false,
        modal: false,
        onProgress: function (br, be) {
          if (be === 0) return;
          var per = Math.ceil(br / be * 100);
          txt.text(per === 100 ? 'Processing...':
              'Uploading ' + per + '%');
          bar.width((br / be * 100) + '%');
        },
        onError: function (assembly) {
          mps.publish('flash/new', [{
            message: assembly.error + ': ' + assembly.message,
            level: 'error'
          }, false]);
          bar.parent().remove();
          attachment.uploading = false;
        },
        onSuccess: _.bind(function (assembly) {
          if (_.isEmpty(assembly.results)) {
            mps.publish('flash/new', [{
              message: 'Whoa, there. You tried to attach an invalid file type.',
              level: 'alert'
            }, true]);
            bar.parent().remove();
          } else {
            attachment.assembly = assembly;
            txt.text('');
          }
          this.app.title('Climb');
          attachment.uploading = false;
        }, this)
      };

      // Use formData object if exists (dnd only)
      if (data) opts.formData = data;

      // Setup the uploader.
      var uploader = this.postForm.transloadit(opts);

      // For canceling.
      $('.upload-remove', set).click(function (e) {
        uploader.cancelled = true;
        if (uploader.instance) {
          clearTimeout(uploader.timer);
          uploader._poll('?method=delete');
        }
        bar.parent().remove();
        attachment.uploading = false;
        delete attachment.assembly;
      });

      // Send files to Transloadit.
      this.postForm.submit();

      // Clear form events.
      this.postForm.unbind('submit.transloadit');

      return false;
    },

    submit: function (e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      // Error checks.
      var uploading = false;
      var valid = true;
      _.each(this.attachments, function (a) {
        if (a.uploading) uploading = true;
        if (a.assembly) {
          if (a.assembly.ok !== 'ASSEMBLY_COMPLETED') {
            mps.publish('flash/new', [{
              message: 'Upload failed. Please try again.',
              level: 'error'
            }, true]);
            valid = false;
          }
        }
      });
      if (uploading) {
        mps.publish('flash/new', [{
          message: 'Whoa, there. Uploads are still in progress...',
          level: 'alert'
        }, true]);
        return false;
      }
      if (!valid) return false;

      // Sanitize html fields.
      this.postTitle.val(util.sanitize(this.postTitle.val()));
      this.postBody.val(util.sanitize(this.postBody.val()));

      // Gather form data.
      var payload = this.postForm.serializeObject();
      delete payload.params;
      var results = {};
      _.each(this.attachments, function (a) {
        if (!a.assembly) return;
        _.each(a.assembly.results, function (v, k) {
          _.each(v, function (r) {
            if (results[k]) results[k].push(r);
            else results[k] = [r];
          });
        });
      });
      payload.assembly = {results: results};

      // Check for empty post.
      if (payload.body === '' && _.isEmpty(payload.assembly.results))
        return false;

      // Now save the post to server.
      rpc.post('/api/posts', payload,
          _.bind(function (err, data) {

        // Clear fields.
        this.cancel();

        if (err) return console.log(err);

        // TODO: make this optimistic.
        this.collect(data.post);

      }, this));

      return false;
    },

    cancel: function () {
      this.uploading = false;
      this.attachments = [];
      this.postFiles.empty();
      this.postSelect.show();
      this.postTitle.val('');
      this.postBody.val('').focus().keyup();
    },

    focus: function (e) {
      this.postBody.css({'min-height': '60px'});
      this.dropZone.addClass('focus');
      if (!this.uploading) {
        this.postParams.show();
        this.postSelect.show();
      }
    },

    blur: function (e) {
      this.dropZone.removeClass('focus');
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
        var showingall = this.parentView.$('.list-spin .empty-feed');
        if (list.items.length === 0) {
          this.nomore = true;
          this.fetching = false;
          this.spin.stop();
          this.spin.target.hide();
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            if (this.$('.empty-feed').length === 0)
              $('<span class="empty-feed">' + this.empty_label + '</span>')
                  .appendTo(this.$el);
          }
        } else
          _.each(list.items, _.bind(function (i) {
            this.collection.push(i, {silent: true});
            this.renderLast(true);
          }, this));
        _.delay(_.bind(function () {
          this.fetching = false;
          this.spin.stop();
          if (list.items.length < this.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              showingall.css('display', 'block');
          } else {
            showingall.hide();
            this.spin.target.show();
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
      rpc.post('/api/posts/list', {
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
        updateUI.call(this, data.posts);

      }, this));

    },

    // init pagination
    paginate: function () {
      var wrap = $(window);
      this._paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() + this.$el.offset().top
            - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);

      wrap.scroll(this._paginate).resize(this._paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate).unbind('resize', this._paginate);
    },

    filter: function (e) {

      // Update buttons.
      var chosen = $(e.target);
      if (chosen.hasClass('selected')) return;
      var selected = $('.feed-button.selected', chosen.parent());
      chosen.addClass('selected');
      selected.removeClass('selected');

      // Updata list query.
      if (!this.latest_list.query)
        this.latest_list.query = {};
      if (chosen.hasClass('sort-featured'))
        this.latest_list.query.featured = true;
      else if (chosen.hasClass('sort-recent'))
        delete this.latest_list.query.featured;
      else if (chosen.hasClass('filter-all'))
        delete this.latest_list.query.type;
      else if (chosen.hasClass('filter-video'))
        this.latest_list.query.type = 'video';
      else if (chosen.hasClass('filter-image'))
        this.latest_list.query.type = 'image';
      store.set('feed', {query: this.latest_list.query});

      // Reset the collection.
      this.nomore = false;
      this.latest_list.cursor = 0;
      this.latest_list.more = true;
      this.collection.reset([]);
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.views = [];
      this.more();
    },

  });
});
