/*
 * New log view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/session.new.html',
  'text!../../templates/tick.new.html',
  'views/lists/choices'
], function ($, _, Backbone, mps, rest, util, Spin, template, tickTemp, Choices) {
  return Backbone.View.extend({

    attachments: [],
    mediaToDelete: [],
    className: 'new-session',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.template = _.template(template);
      this.tickTemp = _.template(tickTemp);
      this.$el.html(this.template.call(this, {tick: this.tickTemp.call(this,
          {closable: false})}));

      // Handle selects.
      util.customSelects(this.el);

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        minWidth: 680,
        modal: true
      });

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .new-session-button': 'submit',
      'click .new-session-tried': 'checkTried',
      'click .new-session-sent': 'checkSent',
      'click .modal-cancel': 'cancel',
      'click .modal-delete': 'delete',
      'click .add-crag': 'addNewCrag',
      'click .add-ascent': 'addNewAscent',
      'click .media-delete-existing': 'markMediaForDelete'
    },

    setup: function () {
      var tick = this.options.tick;

      // Save refs.
      this.dropZone = this.$('.post-dnd');
      this.postSelect = this.$('.post-select');
      this.postFiles = this.$('.post-files');
      this.postForm = this.$('.new-session-post-form');
      this.submitButton = this.$('.new-session-button');
      this.submitButtonSpin = new Spin($('.button-spin', this.submitButton), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });
      this.deleteButton = this.$('.modal-delete');
      this.deleteButtonSpin = new Spin($('.button-spin', this.deleteButton), {
        color: '#808080',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

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

      // Init choices.
      this.cragChoices = new Choices(this.app, {
        reverse: true, 
        el: '.new-session-crag-search',
        choose: true,
        onChoose: _.bind(this.validate, this),
        types: ['crags']
      });
      if (this.options.crag_id) {
        this.cragChoices.preChoose({type: 'crags', id: this.options.crag_id},
            !!tick);
      }

      // Init choices.
      var query = this.options.crag_id ? {crag_id: this.options.crag_id}: null;
      this.tickChoices = new Choices(this.app, {
        reverse: true,
        el: '.new-session-ascent-search',
        choose: true,
        onChoose: _.bind(this.validate, this),
        types: ['ascents'],
        query: query
      });
      if (this.options.ascent_id) {
        this.tickChoices.preChoose({type: 'ascents',
            id: this.options.ascent_id}, !!tick);
      }

      // Check for a pending session.
      // - option's tick takes priority
      // - pending session does not restrict crag choice
      var date;
      if (!tick) {
        pending = store.get('pendingSession');
        store.set('pendingSession', false);
        if (pending) {
          tick = pending.actions[0].ticks[0];
          date = pending.date;
        }
      }

      // Handle date.
      var date = this.options.tick ? this.options.tick.date: date;
      date = date ? new Date(date): new Date();
      this.dateInput = this.$('.new-session-datepicker').pickadate({
        onStart: function () {
          this.set('select', [date.getFullYear(), date.getMonth(),
              date.getDate()]);
        },
        onSet: _.bind(this.validate, this)
      });
      this.datePicker = this.dateInput.pickadate('picker');

      // Restric numeric inputs.
      util.numbersOnly(this.$('.numeric'));

      // Autogrow the write comment box.
      this.$('textarea[name="note"]').autogrow();

      // Handle warning, and error displays.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('required') && el.val().trim() === ''
            && !$('.search-choice', el.parent()).is(':visible')) {
          el.addClass('input-warning');
        }
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Handle tips on focus.
      this.$('input[type="text"]').focus(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-warning')) {
          el.removeClass('input-warning');
        }
      });

      // Focus cursor initial.
      _.delay(_.bind(function () {
        if (!this.options.crag_id) {
          this.$('.new-session-crag-search-input').focus();
        } else if (!this.options.ascent_id) {
          this.$('.new-session-tick-search-input').focus();
        } else {
          this.$('textarea[name="note"]').focus();
        }
      }, this), 1);

      // Choose values if tick present.
      if (tick) {
        this.selectOption('duration', tick.duration);
        this.selectOption('performance', tick.performance);
        this.selectOption('grade', tick.grade);
        this.selectOption('feel', tick.feel);
        this.selectOption('tries', tick.tries);
        this.selectOption('rating', tick.rating);
        if (tick.first !== undefined || tick.firstf !== undefined) {
          if (tick.first === true) {
            tick.first = 1;
          } else if (tick.firstf === true) {
            tick.first = 2;
          } else {
            tick.first = 0;
          }
          this.selectOption('first', tick.first);
        }
        if (tick.note) {
          this.$('textarea[name="note"]').val(tick.note);
        }
        if (tick.sent) {
          this.checkSent();
        }
      }

      return this;
    },

    selectOption: function (key, val) {
      if (val === undefined) {
        return;
      }
      var opt = this.$('select[name="' + key + '"] option[value="'
          + val + '"]');
      $('.select-styled', this.$('select[name="' + key + '"]').parent())
          .text(opt.text());
      opt.attr('selected', true);
    },

    destroy: function () {
      $.fancybox.close();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.defer(_.bind(this.cragChoices.destroy, this));
      _.defer(_.bind(this.tickChoices.destroy, this));
      this.$('.upload-remove').click();
      this.undelegateEvents();
      this.stopListening();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    validate: function () {
      var crag = this.cragChoices.choice;
      var tick = this.tickChoices.choice;

      // Ensure the tick is from the crag.
      if (crag) {
        if (tick && tick.model.get('crag_id') !== crag.model.get('id')) {
          this.tickChoices.clearChoice();
        }
        this.tickChoices.options.query.crag_id = crag.model.get('id');
      } else if (!crag) {
        if (tick && !this.tickChoices.options.query.crag_id) {
          this.cragChoices.preChoose({type: 'crags', id: tick.model.get('crag_id')});
        }
        this.tickChoices.options.query = {};
      }

      // Check for in-progress uploads.
      var inProg = this.$('.upload-remove').length > 0;

      // Validate log button.
      var dateTxt = this.dateInput ? this.dateInput.val().trim(): '';
      if (!crag || !tick || dateTxt === '' || inProg) {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
    },

    checkTried: function (e) {
      var ctx = this.$('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', false);
      $(tried).attr('checked', true);
      $('.new-session-tick-details', ctx).hide();
    },

    checkSent: function (e) {
      var ctx = this.$('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', true);
      $(tried).attr('checked', false);
      $('.new-session-tick-details', ctx).show();
    },

    getPayload: function () {

      // Sanitize.
      this.$('input[type!="submit"]:visible, textarea:visible')
          .each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      var tickChoice = this.tickChoices.choice ?
          this.tickChoices.choice.model.attributes: {};
      var cragChoice = this.cragChoices.choice ? 
          this.cragChoices.choice.model.attributes: {};

      // Build the payload.
      var payload = {
        crag_id: cragChoice.id,
        date: this.datePicker.get('select').pick,
        name: (new Date(this.datePicker.get('select').pick)).format('mm.dd.yy')
      };

      // Get all actions.
      // NOTE: the following rides on old functionality that allowed
      // logging of multiple actions w/ multiple ticks. Keeping for now
      // in case that proves to be what's wanted.
      var actions = [];
      var action = {
        index: 0,
        type: tickChoice.type
      };

      // Get tick.
      var ticks = [];
      var tick = {
        index: 0,
        type: tickChoice.type,
        ascent_id: tickChoice.id,
        duration: this.$('select[name="duration"]').val(),
        performance: this.$('select[name="performance"]').val(),
        note: this.$('textarea[name="note"]').val().trim()
      };
      var sent = this.$('.new-session-sent').is(':checked');
      if (sent) {
        _.extend(tick, {
          sent: true,
          grade: this.$('select[name="grade"]').val(),
          feel: this.$('select[name="feel"]').val(),
          tries: this.$('select[name="tries"]').val(),
          rating: this.$('select[name="rating"]').val(),
          first: this.$('select[name="first"]').val()
        });
      }

      // Gather uploaded image data
      var results = {};
      _.each(this.attachments, function (a) {
        if (!a.assembly) return;
        _.each(a.assembly.results, function (v, k) {
          _.each(v, function (r) {
            if (r.cancelled) {
              return;
            }
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

      this.attachments = [];
      tick.media = results;

      ticks.push(tick);
      action.ticks = ticks;
      actions.push(action);
      payload.actions = actions;

      return payload;
    },

    submit: function (e) {
      e.preventDefault();
      var oldTick = this.options.tick;
      var payload = this.getPayload();

      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      var fn = oldTick ? rest.put: rest.post;
      var path = oldTick ? '/api/sessions/' + oldTick.id: '/api/sessions';

      // Delete media.
      this.deleteMedia();

      // Do the API request.
      fn.call(rest, path, payload, _.bind(function (err, data) {

        // Stop spinner.
        this.submitButtonSpin.stop();
        this.submitButton.removeClass('spinning').attr('disabled', false);
        
        if (err) {

          // Set the error display.
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }, true]);
          return;
        }

        // Show success.
        var verb = payload.actions[0].ticks[0].sent ? 'an ascent': 'some work';
        mps.publish('flash/new', [{
          message: 'You ' + (oldTick ? 'updated': 'logged') + ' ' + verb + '.',
          level: 'alert'
        }, true]);

        this.destroy();
        $(window).scrollTop(0);
      }, this));

      return false;
    },

    addNewCrag: function (e) {
      e.preventDefault();
      var p = this.save();
      this.cancel();
      mps.publish('map/add');
      return false;
    },

    addNewAscent: function (e) {
      e.preventDefault();
      var p = this.save();
      this.cancel();
      mps.publish('ascent/add', [{crag_id: p.crag_id, back: true}]);
      return false;
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
      _.each(files, function (file, i) {
        parts.push('<div class="upload-progress-wrap">'
            + (i === 0 ? '<div class="upload-remove">'
            + '<i class="icon-cancel"></i></div>': '')
            + '<div class="upload-progress">' + '<span class="upload-label">',
            file.name, '</span><span class="upload-progress-txt">'
            + 'Waiting...</span>', '</div></div>');
        if (data && typeof file === 'object') {
          data.append('file', file);
        }
      });
      this.postFiles.append(set.html(parts.join('')));
      var bar = $('.upload-progress', set);
      var txt = $('.upload-progress-txt', set);
      var attachment = {uploading: true};
      this.attachments.push(attachment);
      this.validate();

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
          set.remove();
          attachment.uploading = false;
          this.validate();
        }, this),
        onSuccess: _.bind(function (assembly) {
          if (_.isEmpty(assembly.results)) {
            mps.publish('flash/new', [{
              message: 'Whoa, there. You tried to attach an invalid file type.',
              level: 'alert'
            }, true]);
            set.remove();
          } else {
            txt.text('');
            set.remove();
            attachment.assembly = assembly;
            var files = assembly.results;
            _.each(files, _.bind(function (v, k) {
              _.each(v, _.bind(function (file) {
                var preview;
                switch (k) {
                  case 'image_full':
                  case 'image_full_gif':
                    preview = _.find(files.image_thumb, function (img) {
                      return img.original_id === file.original_id;
                    });
                    break;
                  case 'video_encode_iphone':
                    preview = _.find(files.video_thumbs, function (img) {
                      return img.original_id === file.original_id;
                    });
                    break;
                }
                if (!preview) {
                  return;
                }
                var w = 98;
                var h = preview.meta.height * w / preview.meta.width;
                var icon = '';
                if (preview.type === 'video') {
                  var ih = (h / 2) - 12;
                  icon = '<i class="icon-youtube-play" style="top: '
                      + ih + 'px;"></i>';
                }
                var li = $('<li id="' + preview.original_id + '">' + icon
                    + '<span class="media-delete"><i class="icon-cancel">'
                    + '</i></span><img src="' + preview.ssl_url
                    + '" width="' + w + '" height="' + h + '"></li>');
                li.insertBefore(this.$('.post-previews .clear:last'));
                var n = this.$('.post-previews').children('li');
                if (n-1 % 6 === 0) {
                  $('<div class="clear">').insertBefore(li);
                }
                $('.media-delete', li).click(_.bind(function (e) {
                  _.each(files, function (v, k) {
                    _.each(v, function (file) {
                      if (file.original_id === preview.original_id) {
                        file.cancelled = true;
                      }
                    });
                  });
                  li.remove();
                  this.arrangeMedia();
                }, this));
              }, this));
            }, this));
          }
          attachment.uploading = false;
          this.validate();
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
        set.remove();
        attachment.uploading = false;
        delete attachment.assembly;
        this.validate();
      });

      // Send files to Transloadit.
      this.postForm.submit();

      // Clear form events.
      this.postForm.unbind('submit.transloadit');

      return false;
    },

    save: function () {
      var payload = this.getPayload();
      store.set('pendingSession', payload);
      return payload;
    },

    cancel: function (e) {
      if (e) {
        e.preventDefault();
      }
      this.destroy();
    },

    delete: function (e) {
      if (e) {
        e.preventDefault();
      }
      if (!this.armedForDelete) {
        this.armedForDelete = true;
        this.deleteButton.addClass('armed');
        $('span', this.deleteButton).text('Confirm delete');
        return;
      }
      var oldTick = this.options.tick;

      this.deleteButtonSpin.start();
      this.deleteButton.addClass('spinning').attr('disabled', true);

      rest.delete('/api/ticks/' + oldTick.id, {}, _.bind(function (err, data) {

        // Stop spinner.
        this.deleteButtonSpin.stop();
        this.deleteButton.removeClass('spinning').attr('disabled', false);
        
        if (err) {

          // Set the error display.
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }, true]);
          return;
        }

        // Show success.
        var verb = oldTick.sent ? 'an ascent': 'some work';
        mps.publish('flash/new', [{
          message: 'You deleted an ' + verb + '.',
          level: 'alert'
        }, true]);

        this.destroy();
      }, this));
    },

    markMediaForDelete: function (e) {
      e.preventDefault();
      var li = $(e.target).closest('li');
      this.mediaToDelete.push(li.data('mid'));
      li.remove();
      this.arrangeMedia();
    },

    deleteMedia: function () {
      _.each(this.mediaToDelete, function (mid) {
        rest.delete('/api/medias/' + mid, {}, function (err, data) {
          if (err) {
            console.log(err);
            return;
          }
        });
      });

      return false;
    },

    arrangeMedia: function () {
      this.$('.post-previews .clear').remove();
      this.$('.post-previews').each(function (el, i) {
        if (i % 6 === 0) {
          $('<div class="clear">').insertBefore(this);
        }
      });
      $('<div class="clear">').appendTo(this.$('.post-previews'));
    }

  });
});
