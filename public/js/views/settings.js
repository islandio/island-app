/*
 * Settings view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc',
  'util',
  'models/member',
  'text!../../../templates/settings.html',
  'text!../../../templates/confirm.html',
  'Spin'
], function ($, _, Backbone, Modernizr, mps, rpc, util, Member,
      template, confirm, Spin) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    el: '#main',
    uploading: false,

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;
      
      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Member(this.app.profile.content.page);

      // Set page title
      this.app.title('Settings');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #demolish': 'demolish',
    },

    // Misc. setup.
    setup: function () {

      // Save refs
      this.bannerForm = this.$('#settings_banner_form');
      this.dropZone = this.$('#settings_banner_dnd');
      this.banner = this.$('img.settings-banner');

      // Init the banner uploading indicator.
      this.bannerSpin = new Spin(this.$('#settings_banner_spin'));

      // Autogrow all text areas.
      this.$('textarea').autogrow();

      // Save field contents on blur.
      this.$('textarea, input[type="text"]')
          .change(_.bind(this.save, this))
          .keyup(function (e) {
        var field = $(e.target);
        var label = $('label[for="' + field.attr('name') + '"]');
        var saved = $('div.setting-saved', label.parent().parent());

        if (field.val().trim() !== field.data('saved'))
          saved.hide();

        return false;
      });

      this.banner.bind('mousedown', _.bind(this.position, this));

      // Add mouse events for dummy file selector.
      var dummy = this.$('#banner_file_chooser_dummy');
      this.$('#banner_file_chooser').on('mouseover', function (e) {
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
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    // Save the field.
    save: function (e) {
      var field = $(e.target);
      var name = field.attr('name');
      var label = $('label[for="' + name + '"]');
      var saved = $('div.setting-saved', label.parent().parent());
      var errorMsg = $('span.setting-error', label.parent().parent()).hide();
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (val === field.data('saved')) return false;
      var payload = {};
      if (name.indexOf('.') !== -1) {
        var tmp = {};
        tmp[name.substr(name.indexOf('.') + 1)] = val;
        payload[name.substr(0, name.indexOf('.'))] = tmp;
      } else payload[name] = val;

      // Now do the save.
      rpc.put('/api/members/' + this.app.profile.member.username, payload,
          _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          errorMsg.text(err).show();

          // Clear fields.
          if (err === 'Username exists')
            field.addClass('input-error').focus();

          return;
        }

        // Update profile.
        _.extend(this.app.profile.member, payload);

        // Save the saved state and show indicator.
        field.data('saved', val);
        saved.show();

      }, this));

      return false;
    },

    position: function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (this.uploading) return false;
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
        if (top <= 0 && w.y + top >= 215) {
          this.bannerTop = top;
          this.banner.css({top: top + 'px'});
        }
        if (left <= 0 && w.x + left >= 480) {
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
        if (!self.uploading) return false;
        rpc.put('/api/members/' + self.app.profile.member.username, {
          bannerLeft: self.bannerLeft,
          bannerTop: self.bannerTop
        }, function (err, data) {
          if (err) return console.error(err);
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

      // Stop drag styles.
      this.dropZone.removeClass('dragging');

      // Don't do anything if already doing it.
      if (this.uploading) return false;
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
          rpc.put('/api/members/' + this.app.profile.member.username,
              {assembly: assembly}, _.bind(function (err, data) {

            // Resets.
            this.bannerSpin.stop();
            this.dropZone.removeClass('uploading');

            if (err) {

              // Oops, banner wasn't saved.
              console.log('TODO: Retry, notify user, etc.');
              return;
            }

            var banner = assembly.results.image_full[0];
            var _w = 480, _h = 215;
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
      if (data) opts.formData = data;

      // Init Transloadit.
      this.bannerForm.transloadit(opts);
      this.bannerForm.submit();

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)(), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Add placeholder shim if need to.
      if (Modernizr.input.placeholder)
        this.$('input').placeholder();
      
      // Refs.
      var overlay = $('.confirm-overlay');
      var username = $('.confirm input.username-for-delete');
      username.focus();

      // Setup actions.
      $('#confirm_cancel').click(function (e) {
        $.fancybox.close();
      });
      $('#confirm_delete').click(_.bind(function (e) {

        // Show the in-modal overlay.
        overlay.show();

        // Delete the member.
        rpc.delete('/api/members/' + this.app.profile.member.username,
            {}, _.bind(function (err, data) {
          if (err) {

            // Oops.
            console.log('TODO: Retry, notify user, etc.');
            return;
          }

          // Change overlay message.
          $('p', overlay).text('Hasta la pasta! - Love, Island');

          // Logout client-side.
          mps.publish('member/delete');

          // Route to home.
          this.app.router.navigate('/', {trigger: true});

          // Wait a little then close the modal.
          _.delay(_.bind(function () {
            $.fancybox.close();
          }, this), 2000);

        }, this));        
      }, this));

      return false;
    }

  });
});
