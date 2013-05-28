/*
 * Posts List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/posts.html',
  'collections/posts',
  'views/rows/post',
  'Spin'
], function ($, _, List, mps, rpc, util, template, Collection, Row, Spin) {
  return List.extend({
    
    el: '#posts',

    fetching: false,
    nomore: false,
    limit: 3,
    attachments: false,
    uploading: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('#posts-spin', this.parentView.el));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.socket.subscribe('posts').bind('post.new',
          _.bind(this.collect, this));

      // Reset the collection.
      this.latest_list = this.app.profile.content.posts;
      this.collection.reset(this.latest_list.items);
    },

    // collect new posts from socket events.
    collect: function (post) {
      this.collection.unshift(post);
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
        $('<span class="empty-feed">No posts.</span>').appendTo(this.$el);
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

    events: {
      'focus textarea[name="body"].post-input': 'focus',
      'blur textarea[name="body"].post-input': 'blur'
    },

    // misc. setup
    setup: function () {

      if (this.app.profile.transloadit) {

        // Save refs
        this.postForm = this.$('#post_input_form');
        this.postBody = $('textarea[name="body"]', this.postForm);
        this.postTitle = this.$('input[name="title"]', this.postForm);
        this.postButton = this.$('#post_button', this.postForm);
        this.dropZone = this.$('#post_dnd');
        this.postParams = this.$('#post_params');
        this.postSelect = this.$('#post_select');
        this.postFiles = this.$('#post_files');
        this.postProgressWrap = this.$('#post_progress_wrap');
        this.postProgress = this.$('#post_progress');
        this.postProgressTxt = this.$('#post_progress_txt');

        // Autogrow the write comment box.
        this.postBody.autogrow().on('keyup', _.bind(this.validate, this));

        // Show the write comment box.
        this.$('#post_input .post').show();

        // Add mouse events for dummy file selector.
        var dummy = this.$('#file_chooser_dummy');
        this.$('#file_chooser').on('mouseover', function (e) {
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
        this.postButton.click(_.bind(this.submit, this, null))
        this.postButton.click(_.bind(this.begin, this));
      }

      return List.prototype.setup.call(this);
    },

    validate: function (e) {
      if (!this.attachments) {
        if (this.postBody.val().trim() === '') {
          if (!this.postButton.hasClass('disabled'))
            this.postButton.addClass('disabled').attr('disabled', 'disabled');
        } else {
          if (this.postButton.hasClass('disabled'))
            this.postButton.removeClass('disabled').attr('disabled', false);
        }
      } else {
        if (this.postButton.hasClass('disabled'))
          this.postButton.removeClass('disabled').attr('disabled', false);
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

      // Don't do anything if already doing it.
      if (this.uploading) return false;

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) {
        this.attachments = false;
        this.postForm.unbind('submit.transloadit');
        return;
      }
      this.attachments = true;
      this.validate();
      var data = e.target.files ? null:
          new FormData(this.postForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      var list = [];
      _.each(files, function (file) {
        list.push('<span>- ', file.name + ' ('
            + util.addCommas(file.size) + ' bytes)', '</span>');
        if (data && typeof file === 'object') data.append('file', file);
      });
      this.postFiles.html(list.join('')).show();

      // Transloadit options
      var opts = {
        wait: true,
        autoSubmit: false,
        modal: false,
        onProgress: _.bind(this.progress, this),
        onError: function(assembly) {
          console.log(assembly.error + ': ' + assembly.message);
        },
        onSuccess: _.bind(function () {
          this.uploading = false;
          this.submit.apply(this, arguments);
        }, this)
      };

      // Use formData object if exists (dnd only)
      if (data) opts.formData = data;

      // Bind the submit button to transloadit.
      this.postButton.unbind('click');
      this.postButton.click(_.bind(this.begin, this));
      this.postForm.transloadit(opts);

      return false;
    },

    begin: function (e) {
      if (this.uploading) return false;
      this.uploading = true;
      this.postButton.addClass('disabled').attr('disabled', 'disabled');
      this.postTitle.addClass('disabled').attr('disabled', 'disabled');
      if (this.attachments) {
        _.delay(_.bind(function () {
          this.postSelect.slideUp('fast');
          this.postProgressWrap.show();
        }, this), 500);
        this.postForm.submit();
      }

      return true;
    },

    progress: function(br, be) {
      if (be === 0) return;
      var per = Math.ceil(br / be * 100);
      this.postProgressTxt.text(per === 100 ? 'Processing...':
          'Uploading ' + per + '%');
      if (this.postProgress.width() > 100
          && !this.postProgressTxt.is(':visible')) this.postProgressTxt.show();
      this.postProgress.width((br / be * 100) + '%');
    },

    submit: function (assembly, e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (this.uploading) return false;

      // Error checks
      if (assembly) {
        if (assembly.ok !== 'ASSEMBLY_COMPLETED')
          return this.postProgressTxt.text('Upload failed. Please try again.');
        if (_.isEmpty(assembly.results))
          return this.postProgressTxt.text('You must choose a file.');
        this.postProgressTxt.text('Complete');
      }

      // Sanitize html fields.
      this.postTitle.removeClass('disabled').attr('disabled', false);
      this.postTitle.val(util.sanitize(this.postTitle.val()));
      this.postBody.val(util.sanitize(this.postBody.val()));

      // Gather form data.
      var payload = this.postForm.serializeObject();

      delete payload.params;
      payload.assembly = assembly;

      // Now save the comment to server.
      rpc.post('/api/posts', payload,
          _.bind(function (err, data) {

        // Clear fields.
        this.cancel();

        if (err) {

          // Oops, comment wasn't created.
          console.log('TODO: Retry, notify user, etc.');
          return;
        }

        // TODO: make this optimistic.
        this.collect(data.post);

      }, this));

      return false;
    },

    cancel: function () {
      this.uploading = false;
      this.attachments = false;
      this.postFiles.empty().hide();
      this.postProgressWrap.hide();
      this.postSelect.show();
      this.postProgress.width(0);
      this.postProgressTxt.text('Waiting...');
      this.postButton.removeClass('disabled').attr('disabled', false);
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
        if (list.items.length === 0) {
          this.nomore = true;
          this.spin.target.hide();
          var showingall = this.parentView.$('.list-spin .empty-feed');
          if (this.collection.length > 0)
            showingall.css('display', 'block');
          else {
            showingall.hide();
            $('<span class="empty-feed">No posts.</span>')
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
      var paginate = _.debounce(_.bind(function (e) {
        var pos = this.$el.height() + this.$el.offset().top
            - wrap.height() - wrap.scrollTop();
        if (!this.nomore && pos < -this.spin.target.height() / 2)
          this.more();
      }, this), 50);

      wrap.scroll(paginate).resize(paginate);
    },

  });
});
