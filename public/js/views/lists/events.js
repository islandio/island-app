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
  'lib/textarea-caret-position/index',
  'text!../../../templates/lists/events.html',
  'collections/events',
  'views/rows/event',
  'views/lists/choices',
], function ($, _, List, mps, rest, util, Spin, Caret,
    template, Collection, Row, Choices) {
  return List.extend({

    el: '.events',

    initialize: function (app, options) {

      this.fetching = false;
      this.nomore = false;
      this.attachments = [];

      this.template = _.template(template);
      this.collection = new Collection();
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Init the load indicator.
      this.spin = new Spin($('.events-spin', this.$el.parent()));
      this.spin.start();

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('event.new', this.collect);
      this.app.rpc.socket.on('event.removed', this._remove);

      // Reset the collection.
      this.latestList = this.app.profile.content.events;
      if (this.latestList) {
        this.collection.reset(this.latestList.items);
      }
    },

    // receive event from event bus
    collect: function (data) {
      if (!_.contains(this.latestList.actions, data.action_type)) {
        return;
      }
      if (this.latestList.query) {
        if (this.latestList.query.subscribee_id &&
            data.actor_id !== this.latestList.query.subscribee_id &&
            data.target_id !== this.latestList.query.subscribee_id) {
          return;
        }
        if (this.latestList.query.action) {
          if (data.action_type !== this.latestList.query.action.type) {
            return;
          }
          var valid = true;
          _.each(this.latestList.query.action.query, function (v, p) {
            if (v.$ne !== undefined) {
              v = !v.$ne;
              if (!!data.action[p] !== v) {
                valid = false;
              }
            } else if (data.action[p] !== v) {
              valid = false;
            }
          });
          if (!valid) return;
        }
      }
      this.collection.unshift(data);
    },

    // initial bulk render of list
    render: function (options) {
      List.prototype.render.call(this, options);
      this.spin.stop();
      if (this.collection.length > 0) {
        _.delay(_.bind(function () {
          this.checkHeight();
        }, this), (this.collection.length + 1) * 30);
      } else {
        this.nomore = true;
        this.listSpin.hide();
        if (this.app.profile.content.private) {
          $('<span class="empty-feed">This athlete is private.</span>')
            .appendTo(this.$el);
        } else {
          $('<span class="empty-feed">Nothing to see here yet.</span>')
              .appendTo(this.$el);
        }
        this.spin.stop();
        this.spin.target.hide();
      }
      this.paginate();
      return this;
    },

    renderLast: function (pagination) {
      List.prototype.renderLast.call(this, pagination);

      // Handle day headers.
      var view;
      if (!this.collection.options ||
          this.collection.options.headers !== false) {
        view = pagination !== true && this.collection.options &&
            this.collection.options.reverse ?
            this.views[0]:
            this.views[this.views.length - 1];
        var ms = new Date(view.model.get('date')).valueOf();
        var header = this.$('.event-day-header').filter(function () {
          return ms >= Number($(this).data('beg')) &&
              ms <= Number($(this).data('end'));
        });
        if (header.length > 0) {
          if (pagination !== true) {
            header.detach().insertBefore(view.$el);
            var uniq = _.uniq(view.$el.parent().children('.event'), function (el) {
              return $(el).attr('id');
            });
            if (uniq.length > 1) {
              $('<div class="event-divider">').insertAfter(view.$el).show();
            }
          } else {
            $('<div class="event-divider">').insertBefore(view.$el).show();
          }
        } else {
          var _date = new Date(view.model.get('date'));
          var beg = new Date(_date.getFullYear(), _date.getMonth(),
              _date.getDate());
          var end = new Date(_date.getFullYear(), _date.getMonth(),
              _date.getDate(), 23, 59, 59, 999);
          header = $('<div class="event-day-header" data-beg="' + beg.valueOf() +
              '" data-end="' + end.valueOf() + '">' + '<span>' +
              end.format('mmmm dd, yyyy') + '</span></div>');
          header.insertBefore(view.$el);
        }
      } else {
        view = pagination !== true && this.collection.options &&
            this.collection.options.reverse ?
            this.views[0]:
            this.views[this.views.length - 1];
        $('<div class="event-divider">').insertBefore(view.$el).show();
      }

      // Check for more.
      _.delay(_.bind(function () {
        if (pagination !== true) {
          this.checkHeight();
        }
      }, this), 20);
      return this;
    },

    events: {
      'focus textarea[name="body"].post-input': 'focus',
      'blur textarea[name="body"].post-input': 'blur',
      'keydown textarea[name="body"].post-input': 'keydown',
      'input textarea[name="body"].post-input': 'input',
      'click .events-filter .subtab': 'filter',
    },

    // misc. setup
    setup: function () {

      // Save refs
      this.listSpin = this.parentView.$('.list-spin');
      this.showingAll = this.parentView.$('.list-spin .empty-feed');
      this.postForm = this.$('.post-input-form');
      this.postBody = $('textarea[name="body"]', this.postForm);
      this.postSearch = $('.inline-search');
      this.postTitle = this.$('input[name="title"]', this.postForm);
      this.postButton = this.$('.post-button', this.postForm);
      this.dropZone = this.$('.post-dnd');
      this.postParams = this.$('.post-params');
      this.postSelect = this.$('.post-select');
      this.postFiles = this.$('.post-files');

      this.choices = new Choices(this.app, {
        reverse: true,
        el: this.postSearch,
        choose: true,
        onChoose: _.bind(this.choose, this),
        types: ['members']
      });

      // Autogrow the write comment box.
      this.postBody.autogrow();

      // Show the write post box if it exists and
      // if the user is not using IE.
      if (navigator.userAgent.indexOf('MSIE') !== -1) {
        this.$('.post-input .post').remove();
        mps.publish('flash/new', [{
          message: 'Internet Explorer isn\'t supported for posting content.' +
              ' Please use Safari, Chrome, or Firefox.',
          level: 'error',
          sticky: true
        }, true]);
      } else {
        this.$('.post-input .post').show();
      }

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
      this.app.rpc.socket.removeListener('event.new', this.collect);
      this.app.rpc.socket.removeListener('event.removed', this._remove);
      this.choices.hide();
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
        var prev = view.$el.prev();
        if (prev.hasClass('event-divider')) {
          prev.remove();
        }
        view._remove(_.bind(function () {
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
      if (wh - so > this.spin.target.height() / 2) {
        this.more();
      }
    },

    getQuery: function() {
      if (this.latestList) {
        return this.latestList.query;
      }
    },

    changeQuery: function(query) {
      this.latestList.cursor = 0;
      this.latestList.more = true;
      this.latestList.query = query;
      this.nomore = false;
      this.collection.reset();
      this.$('.event-day-header').remove();
      _.each(this.views, function(v) {
        v.destroy();
      });
      this.$('.event-divider').remove();
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
      rest.post('/api/events/list', {
        limit: this.latestList.limit,
        cursor: this.latestList.cursor,
        sort: this.latestList.sort,
        actions: this.latestList.actions,
        query: this.latestList.query
      }, _.bind(function (err, data) {

        if (err) {
          this.spin.stop();
          this.spin.target.hide();
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
      if (files.length === 0) {
        return false;
      }

      // We have files to upload.
      var data = e.target.files ? null: new FormData(this.postForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      var set = $('<div class="upload-set">');
      var parts = [];
      _.each(files, function (file) {
        parts.push('<div class="upload-progress-wrap"><div class="upload-remove">' +
            '<i class="icon-cancel"></i></div><div ' +
            'class="upload-progress">' + '<span class="upload-label">',
            file.name, '</span><span class="upload-progress-txt">' +
            'Waiting...</span>', '</div></div>');
        if (data && typeof file === 'object') {
          data.append('file', file);
        }
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
        onError: _.bind(function (assembly) {
          mps.publish('flash/new', [{
            message: assembly.error + ': ' + assembly.message,
            level: 'error',
            sticky: true
          }, false]);
          bar.parent().remove();
          this.parentView.setTitle();
          attachment.uploading = false;
        }, this),
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
          this.parentView.setTitle();
          attachment.uploading = false;
        }, this)
      };

      // Use formData object if exists (dnd only)
      if (data) {
        opts.formData = data;
      }

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
        if (a.uploading) {
          uploading = true;
        }
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
      if (!valid) {
        return false;
      }

      // Sanitize html fields.
      this.postTitle.val(util.sanitize(this.postTitle.val()));
      this.postBody.val(util.sanitize(this.postBody.val()));

      // Gather form data.
      var payload = this.postForm.serializeObject();
      delete payload.params;
      var results = {};
      _.each(this.attachments, function (a, i) {
        if (!a.assembly) return;
        _.each(a.assembly.results, function (v, k) {
          _.each(v, function (r) {
            r._index = i;
            r.assembly_id = a.assembly.assembly_id;
            if (results[k]) {
              results[k].push(r);
            } else {
              results[k] = [r];
            }
          });
        });
      });
      payload.assembly = {results: results};

      // Check for empty post.
      if (payload.body === '' && _.isEmpty(payload.assembly.results)) {
        return false;
      }

      // Add parent (if parent).
      if (this.collection.options.parentId &&
          this.collection.options.parentType) {
        payload.parent_id = this.collection.options.parentId;
        payload.type = this.collection.options.parentType;
      }

      // Now save the post to server.
      rest.post('/api/posts', payload, _.bind(function (err, data) {
        if (err) console.log(err);

        // Clear fields.
        this.cancel();
        this.unfocus();
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

    unfocus: function (e) {
      if (!isMobile()) {
        this.postBody.css({'min-height': 'inherit'})
      }
      this.postBody.blur();
      this.postParams.hide();
      this.postSelect.hide();
    },

    keydown: function(e) {
      var re = /\B@(\S*?)$/;
      var res = re.exec(this.postBody.val());
      if (res && this.choices.count() !== 0) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13)) {
          this.choices.chooseExternal();
          return false;
        } else if (!e.shiftKey && (e.keyCode === 9 || e.which === 9)) {
          this.choices.chooseExternal();
          return false;
        } else if (!e.shiftKey && (e.keyCode === 38 || e.which === 38)) {
          this.choices.up();
          return false;
        } else if (!e.shiftKey && (e.keyCode === 40 || e.which === 40)) {
          this.choices.down();
          return false;
        }
      }
    },

    input: function(e) {
      // Test for @ pattern ending in the text area
      var re = /\B@(\S*?)$/;
      var res = re.exec(this.postBody.val());
      if (res) {
        var caretCoord = window.getCaretCoordinates(this.postBody[0], res.index);
        var searchTop = (this.postBody.offset().top -
            this.postSearch.parent().offset().top +
            caretCoord.top + 20) + 'px';
        var searchLeft = (this.postBody.offset().left -
            this.postSearch.parent().offset().left +
            caretCoord.left) + 'px';
        this.postSearch.css({top: searchTop, left: searchLeft});
        this.postSearch.show();
        this.choices.search(null, res[1]);
      } else {
        this.postSearch.hide();
        this.choices.hide();
      }
    },

    choose: function(model) {
      var username = model.get('username');
      var re = /\B@(\S*?)$/;
      var res = re.exec(this.postBody.val());
      if (res) {
        var text = this.postBody.val().substr(0, res.index);
        this.postBody.val(text + '@' + username + ' ');
      }
      this.choices.hide();
    },

    blur: function (e) {
      this.dropZone.removeClass('focus');
      // settimeout allows for other events to occur, like clicking the choice
      setTimeout(_.bind(function() {
        this.postSearch.hide();
        this.choices.hide();
      }, this), 500);
    },

    filter: function (e) {
      e.preventDefault();

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active')) return;
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Update list query.
      switch (chosen.data('filter')) {
        case 'all':
          this.latestList.actions = this.collection.options.filters;
          break;
        case 'session':
          this.latestList.actions = ['session'];
          break;
        case 'post':
          this.latestList.actions = ['post'];
          break;
        case 'tick':
          this.latestList.actions = ['tick'];
          break;
      }

      // Set feed state.
      store.set(this.collection.options.feedStore || 'feed',
          {actions: chosen.data('filter')});

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
      this.$('.event-divider').remove();
      this.showingAll.hide();
      this.more();

      return false;
    },

  });
});
