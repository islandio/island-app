/*
 * Events List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../../templates/lists/events.html',
  'collections/events',
  'views/rows/event'
], function ($, _, List, mps, rest, util, Spin, template, Collection, Row) {
  return List.extend({

    el: '.events',

    fetching: false,
    nomore: false,
    attachments: [],

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.events-spin', this.$el.parent()));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('event.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('event.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.latestList = this.app.profile.content.events;
      this.collection.reset(this.latestList.items);
    },

    // receive event from event bus
    collect: function (data) {
      if (_.contains(this.latestList.actions, data.action_type))
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
        $('<span class="empty-feed">No events.</span>').appendTo(this.$el);
        this.spin.stop();
        this.spin.target.hide();
      }
      this.paginate();
      return this;
    },

    // render the latest model
    // (could be newly arrived or older ones from pagination)
    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);

      // Handle day headers.
      var view = pagination !== true && this.collection.options
          && this.collection.options.reverse ?
          this.views[0]:
          this.views[this.views.length - 1];  
      var ms = new Date(view.model.get('date')).valueOf();
      var header = this.$('.event-day-header').filter(function () {
        return ms >= Number($(this).data('beg'))
            && ms <= Number($(this).data('end'));
      });
      if (header.length > 0)
        header.detach().insertBefore(view.$el);
      else {
        var _date = new Date(view.model.get('date'));
        var beg = new Date(_date.getFullYear(), _date.getMonth(),
            _date.getDate());
        var end = new Date(_date.getFullYear(), _date.getMonth(),
            _date.getDate(), 23, 59, 59, 999);
        header = $('<div class="event-day-header" data-beg="' + beg.valueOf()
            + '" data-end="' + end.valueOf() + '">' + '<span>'
            + end.format('mmmm dd, yyyy') + '</span></div>');
        header.insertBefore(view.$el);
      }

      // Check for more.
      _.delay(_.bind(function () {
        if (pagination !== true)
          this.checkHeight();
      }, this), 20);
      return this;
    },

    events: {
      'focus textarea[name="body"].post-input': 'focus',
      'blur textarea[name="body"].post-input': 'blur',
      'click .events-filter .subtab': 'filter',
    },

    // misc. setup
    setup: function () {

      // Save refs
      this.showingall = this.parentView.$('.list-spin .empty-feed');
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
          message: 'Internet Explorer isn\'t supported for posting content.'
              + ' Please use Safari, Chrome, or Firefox.',
          level: 'error',
          sticky: true
        }, true]);
      } else
        this.$('.post-input .post').show();

      // Add mouse events for dummy file selector.
      var dummy = this.$('.post-file-chooser-dummy');
      this.$('.post-file-chooser').on('mouseover', function (e) {
        dummy.addClass('hover');
      })
      .on('mouseout', function (e) { dummy.removeClass('hover'); })
      .on('mousedown', function (e) { dummy.addClass('active'); })
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
      this.app.rpc.socket.removeAllListeners('event.new');
      this.app.rpc.socket.removeAllListeners('event.removed');
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
          this.$('.event-day-header').filter(function () {
            return $(this).next('.event').length === 0;
          }).remove();
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
        this.latestList = list;
        if (list.items.length === 0) {
          this.nomore = true;
          this.fetching = false;
          this.spin.stop();
          this.spin.target.hide();
          if (this.collection.length > 0)
            this.showingall.css('display', 'block');
          else {
            this.showingall.hide();
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
          if (list.items.length < this.latestList.limit) {
            this.spin.target.hide();
            if (!this.$('.empty-feed').is(':visible'))
              this.showingall.css('display', 'block');
          } else {
            this.showingall.hide();
            this.spin.target.show();
          }
        }, this), (list.items.length + 1) * 30);
      }

      // already waiting on server
      if (this.fetching) return;

      // there are no more, don't call server
      if (this.nomore || !this.latestList.more)
        return updateUI.call(this, _.defaults({items:[]}, this.latestList));

      // get more
      this.spin.start();
      this.fetching = true;
      rest.post('/api/events/list', {
        limit: this.latestList.limit,
        cursor: this.latestList.cursor,
        actions: this.latestList.actions,
        query: this.latestList.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.fetching = false;
          return console.error(err.stack);
        }

        // Add the items.
        updateUI.call(this, data.events);

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
      }, this), 20);

      wrap.scroll(this._paginate).resize(this._paginate);
    },

    unpaginate: function () {
      $(window).unbind('scroll', this._paginate).unbind('resize', this._paginate);
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
          this.parentView.title();
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
          this.parentView.title();
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
      rest.post('/api/posts', payload,
          _.bind(function (err, data) {
        if (err) console.log(err);

        // Clear fields.
        this.cancel();
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

    filter: function (e) {

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active')) return;
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Update list query.
      switch (chosen.data('filter')) {
        case 'all':
          this.latestList.actions = ['session', 'post'];
          break;
        case 'session':
          this.latestList.actions = ['session'];
          break;
        case 'post':
          this.latestList.actions = ['post'];
          break;
      }

      // Set feed state.
      store.set('feed', {actions: chosen.data('filter')});

      // Reset the collection.
      this.nomore = false;
      this.latestList.cursor = 0;
      this.latestList.more = true;
      this.collection.reset([]);
      _.each(this.views, function (v) {
        v.destroy();
      });
      this.views = [];
      this.$('.event-day-header').remove();
      this.showingall.hide();
      this.more();
    },

  });
});
