/*
 * Member settings view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'models/member',
  'text!../../templates/settings.html',
  'text!../../templates/profile.title.html',
  'text!../../templates/confirm.html',
  'text!../../templates/tip.html'
], function ($, _, Backbone, mps, rest, util, Spin, Model,
      template, title, confirm, tip) {

  return Backbone.View.extend({

    el: '.main',
    uploading: false,

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Model(this.app.profile.content.page);

      this.app.title('The Island | ' + this.app.profile.member.displayName
          + ' - Settings');
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Render title.
      this.title = _.template(title).call(this, {settings: true});

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .demolish': 'demolish'
    },

    setup: function () {
      this.bannerForm = this.$('.settings-banner-form');
      this.dropZone = this.$('.settings-banner-dnd');
      this.banner = this.$('img.settings-banner');

      // Init the banner uploading indicator.
      this.bannerSpin = new Spin(this.$('.settings-banner-spin'), {
        color: '#4d4d4d'
      });

      // Autogrow all text areas.
      this.$('textarea').autogrow();

      // Save field contents on blur.
      this.$('textarea, input[type="text"], input[type="checkbox"], input[type="radio"]')
          .change(_.bind(this.save, this))
          .keyup(function (e) {
        var field = $(e.target);
        var label = $('label[for="' + field.attr('name') + '"]');
        var saved = $('div.setting-saved', label.parent().next());

        if (field.val().trim() !== field.data('saved')) {
          saved.hide();
        }

        return false;
      });

      this.banner.bind('mousedown', _.bind(this.position, this));

      // Add mouse events for dummy file selector.
      var dummy = this.$('.banner-file-chooser-dummy');
      this.$('.banner-file-chooser').on('mouseover', function (e) {
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

      // Prevent default behavior on form submit.
      this.bannerForm.submit(function(e) {
        e.stopPropagation();
        e.preventDefault();
        return true;
      });

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Show the tip modal.
      if (util.getParameterByName('tip') === 'insta') {
        try {
          window.history.replaceState('', '', window.location.pathname);
        } catch (err) {}
        this.instagram();
      }

      // Handle username.
      this.$('input[name="username"]').bind('keydown', function (e) {
        if (e.which === 32) return false;
      }).bind('keyup', function (e) {
        $(this).val(_.str.slugify($(this).val()).substr(0, 30));
      });

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    save: function (e) {
      e.preventDefault();
      var field = $(e.target);
      var name = field.attr('name');
      // var label = $('label[for="' + name + '"]');
      // var saved = $('div.setting-saved', label.parent().next());
      // var errorMsg = $('span.setting-error', label.parent().next()).hide();
      var val = util.sanitize(field.val());

      // Handle checkbox.
      if (field.attr('type') === 'checkbox') {
        val = field.is(':checked');
      }

      // Create the paylaod.
      if (val === field.data('saved')) {
        return false;
      }
      var payload = {};
      payload[name] = val;

      // Check for email.
      if (payload.primaryEmail && !util.isEmail(payload.primaryEmail)) {
        mps.publish('flash/new', [{
          err: {message: 'Please use a valid email address.'},
          level: 'error'}
        ]);
        field.addClass('input-error').val('').focus();
        return false;
      }

      // Now do the save.
      rest.put('/api/members/' + this.app.profile.member.username, payload,
          _.bind(function (err, data) {
        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error'}]);

          // Show error highlight.
          field.addClass('input-error').val('').focus();

          return false;
        }

        // Update profile.
        _.extend(this.app.profile.member, payload);

        // Save the saved state and show indicator.
        field.data('saved', val);
        // saved.show();

        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert'
        }, true]);

      }, this));

      return false;
    },

    position: function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (this.uploading) {
        return false;
      }
      this.uploading = true;
      var w = {x: this.banner.width(), y: this.banner.height()};
      var m = {x: e.pageX, y: e.pageY};
      var p = {
        x: parseInt(this.banner.css('left')),
        y: parseInt(this.banner.css('top'))
      };

      // Called when moving banner.
      var move = _.bind(function (e) {
        var d = {x: e.pageX - m.x, y: e.pageY - m.y};
        var top = d.y + p.y;
        var left = d.x + p.x;
        if (top <= 0 && w.y + top >= 306) {
          this.bannerTop = top;
          this.banner.css({top: top + 'px'});
        }
        if (left <= 0 && w.x + left >= 680) {
          this.bannerLeft = left;
          this.banner.css({left: left + 'px'});
        }
      }, this);
      this.banner.bind('mousemove', move);
      var self = this;
      $(document).bind('mouseup', function (e) {
        self.banner.unbind('mousemove', move);
        $(document).unbind('mouseup', arguments.callee);

        // Save.
        if (!self.uploading) {
          return false;
        }
        rest.put('/api/members/' + self.app.profile.member.username, {
          bannerLeft: self.bannerLeft,
          bannerTop: self.bannerTop
        }, function (err, data) {
          if (err) {
            return console.log(err);
          }
          self.uploading = false;
        });

        return false;
      });

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

      this.dropZone.removeClass('dragging');
      if (this.uploading) {
        return false;
      }
      this.uploading = true;
      this.bannerSpin.start();
      this.dropZone.addClass('uploading');

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) return;

      var data = e.target.files ? null:
          new FormData(this.bannerForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      var list = [];
      _.each(files, function (file) {
        if (data && typeof file === 'object')
          data.append('file', file);
      });

      // Transloadit options.
      var opts = {
        wait: true,
        autoSubmit: true,
        modal: false,
        onError: _.bind(function (assembly) {
          this.uploading = false;
          this.bannerSpin.stop();
          this.dropZone.removeClass('uploading');
          alert(assembly.error + ': ' + assembly.message);
        }, this),
        onSuccess: _.bind(function (assembly) {
          this.uploading = false;

          // Error checks
          if (assembly) {
            if (assembly.ok !== 'ASSEMBLY_COMPLETED') {
              this.bannerSpin.stop();
              this.dropZone.removeClass('uploading');
              return alert('Upload failed. Please try again.');
            } if (_.isEmpty(assembly.results)) {
              this.bannerSpin.stop();
              this.dropZone.removeClass('uploading');
              return alert('You must choose a file.');
            }
          }

          // Now save the banner to server.
          rest.put('/api/members/' + this.app.profile.member.username,
              {assembly: assembly}, _.bind(function (err, data) {

            // Resets.
            this.bannerSpin.stop();
            this.dropZone.removeClass('uploading');

            if (err) {
              console.log(err);
              return;
            }

            var banner = assembly.results.image_full[0];
            var _w = 680, _h = 306;
            var w, h, o;
            w = _w;
            h = (banner.meta.height / banner.meta.width) * _w;
            if (h - _h >= 0) {
              o = 'top:' + (-(h - _h) / 2) + 'px;';
            } else {
              w = (banner.meta.width / banner.meta.height) * _h;
              h = _h;
              o = 'left:' + (-(w - _w) / 2) + 'px;';
            }
            this.banner.hide();
            _.delay(_.bind(function () {
              this.banner.attr({
                src: banner.url, width: w,
                height: h, style: o
              });
              this.banner.fadeIn('slow');
            }, this), 0);
          }, this));
        }, this)
      };

      // Use formData object if exists (dnd only)
      if (data) {
        opts.formData = data;
      }

      this.bannerForm.transloadit(opts);
      this.bannerForm.submit();

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete your profile forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });
      
      // Refs.
      var overlay = $('.modal-overlay');

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the member.
        rest.delete('/api/members/' + this.app.profile.member.username,
            {}, _.bind(function (err, data) {
          if (err) {
            return console.log(err);
          }

          // Route to home.
          window.location.href = '/';
        }, this));
      }, this));

      return false;
    },

    // Help the user understand how to use Instagram w/ Island.
    instagram: function () {

      // Render the confirm modal.
      $.fancybox(_.template(tip)({
        message: '<strong>You are connected to Instagram.</strong> Now help us'
            + ' map the world of climbing!'
            + ' When you add the #island hashtag to your initial photo'
            + ' caption, we\'ll add it to the Island Map.'
            + '<br /><br />'
            + 'Note: For this to work, location services (GPS) must be enabled'
            + ' for Instagram on your phone and "Add to Photo Map" must be set'
            + ' to "on" when posting.<br /><br />'
            + '&bull; <em>Directions for all iOS devices:</em> Select the '
            + 'Settings icon on the device. Go to Settings > Privacy > Location'
            + ' Services and toggle the setting for Instagram to “on”.<br /><br />'
            + '&bull; <em>Directions for Android phones:</em> Open the camera app.'
            + ' Select the Settings icon on the device. Scroll through the options'
            +' and find GPS tag. Toggle the setting to “on”.',
        title: 'Island &hearts;\'s <img src="' + window.__s + '/img/instagram.png"'
            + ' width="24" height="24" />'
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('#tip_close').click(function (e) {
        $.fancybox.close();
      });
    }

  });
});
