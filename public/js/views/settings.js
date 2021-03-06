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

    initialize: function (app) {
      this.app = app;
      this.bannerUploading = false;
      this.avatarUploading = false;
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.model = new Model(this.app.profile.content.page);

      this.app.title('Island | ' + this.app.profile.member.displayName +
          ' - Settings');
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.title = _.template(title).call(this, {settings: true});

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .demolish': 'demolish',
      'click .clear-ascents': 'clearAscents'
    },

    setup: function () {
      this.bannerForm = this.$('.settings-banner-form');
      this.bannerDropZone = this.$('.settings-banner-dnd');
      this.banner = this.$('img.settings-banner');
      this.removeBannerButton = this.$('a.settings-banner-remove');
      this.bannerSpin = new Spin(this.$('.settings-banner-spin'), {
        color: '#4d4d4d'
      });

      this.avatarForm = this.$('.settings-avatar-form');
      this.avatarForm2 = this.$('.settings-avatar-form2');
      this.avatarDropZone = this.$('.settings-avatar-dnd');
      this.avatar = this.$('img.settings-avatar');
      this.removeAvatarButton = this.$('a.settings-avatar-remove');
      this.avatarSpin = new Spin(this.$('.settings-avatar-spin'), {
        color: '#4d4d4d'
      });

      // Autogrow all text areas.
      this.$('textarea').autogrow();

      // Save field contents on blur.
      this.$('textarea, input[type="text"], input[type="checkbox"], input[type="radio"]')
          .change(_.bind(this.save, this));

      // Handle img positioning.
      this.banner.bind('mousedown', _.bind(this.bannerPosition, this));
      this.avatar.bind('mousedown', _.bind(this.avatarPosition, this));

      // Add mouse events for dummy file selector.
      var bannerDummy = this.$('.banner-file-chooser-dummy');
      this.$('.banner-file-chooser').on('mouseover', function (e) {
        bannerDummy.addClass('hover');
      })
      .on('mouseout', function (e) {
        bannerDummy.removeClass('hover');
      })
      .on('mousedown', function (e) {
        bannerDummy.addClass('active');
      })
      .change(_.bind(this.bannerDrop, this));
      $(document).on('mouseup', function (e) {
        bannerDummy.removeClass('active');
      });
      var avatarDummy = this.$('.avatar-file-chooser-dummy');
      this.$('.avatar-file-chooser').on('mouseover', function (e) {
        avatarDummy.addClass('hover');
      })
      .on('mouseout', function (e) {
        avatarDummy.removeClass('hover');
      })
      .on('mousedown', function (e) {
        avatarDummy.addClass('active');
      })
      .change(_.bind(this.avatarDrop, this));
      $(document).on('mouseup', function (e) {
        avatarDummy.removeClass('active');
      });

      // Drag & drop events.
      this.bannerDropZone.on('dragover', _.bind(this.bannerDragover, this))
          .on('dragleave', _.bind(this.bannerDragout, this))
          .on('drop', _.bind(this.bannerDrop, this));
      this.avatarDropZone.on('dragover', _.bind(this.avatarDragover, this))
          .on('dragleave', _.bind(this.avatarDragout, this))
          .on('drop', _.bind(this.avatarDrop, this));

      // Prevent default behavior on form submit.
      this.bannerForm.submit(function (e) {
        e.stopPropagation();
        e.preventDefault();
        return true;
      });
      this.avatarForm.submit(function (e) {
        e.stopPropagation();
        e.preventDefault();
        return true;
      });
      this.avatarForm2.submit(function (e) {
        e.stopPropagation();
        e.preventDefault();
        return true;
      });

      this.removeBannerButton.click(_.bind(this.removeBanner, this));
      this.removeAvatarButton.click(_.bind(this.removeAvatar, this));

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Show the tip modal.
      if (util.getParameterByName('tip') === 'instagram') {
        try {
          window.history.replaceState('', '', window.location.pathname);
        } catch (err) {}
        this.instagram();
      }

      // Handle username.
      this.$('input[name="username"]').bind('keydown', function (e) {
        if (_.contains([32], e.which)) {
          return false;
        }
      }).bind('keyup', function (e) {
        if (!_.contains([37,38,39,40,9,91,16], e.which)) {
          $(this).val(util.toUsername($(this).val()));
        }
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
          err: {message: 'Please use a valid email address'},
          level: 'error',
          type: 'popup'
        }]);
        field.addClass('input-error').val('').focus();
        return false;
      }
      if (payload.username && payload.username.length < 4) {
        mps.publish('flash/new', [{
          err: {message: 'Username must be > 3 characters'},
          level: 'error',
          type: 'popup'
        }]);
        field.addClass('input-error').val('').focus();
        return false;
      }

      rest.put('/api/members/' + this.app.profile.member.username, payload,
          _.bind(function (err, data) {
        if (err) {

          mps.publish('flash/new', [{err: err, level: 'error', type: 'popup'}]);
          field.addClass('input-error').val('').focus();

          return false;
        }

        payload = util.stringToObject(name, val);
        util.deepExtend(this.app.profile.member, payload);

        field.data('saved', val);

        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert',
          type: 'popup'
        }, true]);

        if (payload.username) {
          window.location = '/settings';
        }

      }, this));

      return false;
    },

    bannerPosition: function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (this.banner.attr('src') === this.app.images.avatar_big) {
        return false;
      }

      if (this.bannerUploading) {
        return false;
      }
      this.bannerUploading = true;

      var w = {x: this.banner.width(), y: this.banner.height()};
      var m = {x: e.pageX, y: e.pageY};
      var p = {
        x: parseInt(this.banner.css('left'), 10),
        y: parseInt(this.banner.css('top'), 10)
      };

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

        rest.put('/api/members/' + self.app.profile.member.username, {
          bannerLeft: self.bannerLeft,
          bannerTop: self.bannerTop
        }, function (err, data) {
          self.bannerUploading = false;
          if (err) {
            return mps.publish('flash/new', [{err: err, level: 'error',
                type: 'popup'}]);
          }

          mps.publish('flash/new', [{message: 'Saved.', level: 'alert',
              type: 'popup'}, true]);
        });

        return false;
      });

      return false;
    },

    bannerDragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.bannerDropZone.addClass('dragging');
    },

    bannerDragout: function (e) {
      this.bannerDropZone.removeClass('dragging');
    },

    bannerDrop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      this.bannerDropZone.removeClass('dragging');
      if (this.bannerUploading) {
        return false;
      }

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) {
        return false;
      }

      this.bannerUploading = true;
      this.bannerSpin.start();
      this.bannerDropZone.addClass('uploading');

      var data = e.target.files ? null:
          new FormData(this.bannerForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      _.each(files, function (file) {
        if (data && typeof file === 'object')
          data.append('file', file);
      });

      var opts = {
        wait: true,
        autoSubmit: true,
        modal: false,
        onError: _.bind(function (assembly) {
          this.bannerUploading = false;
          this.bannerSpin.stop();
          this.bannerDropZone.removeClass('uploading');

          mps.publish('flash/new', [{err: assembly.error + ': ' +
              assembly.message, level: 'error', type: 'popup'}]);
        }, this),
        onSuccess: _.bind(function (assembly) {
          if (assembly) {
            if (assembly.ok !== 'ASSEMBLY_COMPLETED') {
              this.bannerSpin.stop();
              this.bannerDropZone.removeClass('uploading');
              this.bannerUploading = false;
              mps.publish('flash/new', [{
                err: 'Upload failed. Please try again.',
                level: 'error', type: 'popup'
              }]);
              return;
            } if (_.isEmpty(assembly.results)) {
              this.bannerSpin.stop();
              this.bannerDropZone.removeClass('uploading');
              this.bannerUploading = false;
              mps.publish('flash/new', [{err: 'You must choose a file.',
                  level: 'error', type: 'popup'}]);
              return;
            }
          } else {
            this.bannerUploading = false;
            mps.publish('flash/new', [{err: 'No assembly found.',
                level: 'error', type: 'popup'}]);
            return;
          }

          rest.put('/api/members/' + this.app.profile.member.username,
              {assembly: assembly}, _.bind(function (err, data) {

            if (err) {
              this.bannerUploading = false;
              this.bannerSpin.stop();
              this.bannerDropZone.removeClass('uploading');

              mps.publish('flash/new', [{err: err, level: 'error',
                  type: 'popup'}]);
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
            this.banner.attr({src: banner.ssl_url}).load(_.bind(function () {
              this.banner.off('load');
              this.banner.attr({
                width: w,
                height: h,
                style: o
              });
              this.banner.fadeIn('slow');

              this.bannerUploading = false;
              this.bannerSpin.stop();
              this.bannerDropZone.removeClass('uploading');

              this.removeBannerButton.show();

              mps.publish('flash/new', [{message: 'Saved.', level: 'alert',
                  type: 'popup'}, true]);
            }, this));
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

    removeBanner: function (e) {
      if (this.bannerUploading) {
        return false;
      }
      this.bannerUploading = true;

      rest.put('/api/members/' + this.app.profile.member.username, {
        $unset: {image: 1}
      }, _.bind(function (err) {
        var flash = {type: 'popup'};
        if (err) {
          flash.err = err;
          flash.level = 'error';
        } else {
          flash.message = 'Saved.';
          flash.level = 'alert';

          this.banner.attr({src: this.app.images.banner}).load(
              _.bind(function () {
            this.banner.off('load');
            this.banner.attr({
              width: 680,
              height: 306
            }).css({
              top: 0,
              left: 0
            });

            this.removeBannerButton.hide();
          }, this));
        }
        mps.publish('flash/new', [flash]);
        this.bannerUploading = false;
      }, this));

      return false;
    },

    avatarPosition: function (e) {
      e.stopPropagation();
      e.preventDefault();
      var self = this;

      if (self.avatar.attr('src') === self.app.images.avatar_big) {
        return false;
      }

      if (self.avatar.width() === self.avatar.height()) {
        return false;
      }

      if (self.avatarUploading) {
        return false;
      }
      self.avatarUploading = true;

      var w = {x: self.avatar.width(), y: self.avatar.height()};
      var m = {x: e.pageX, y: e.pageY};
      var p = {
        x: parseInt(self.avatar.css('left'), 10),
        y: parseInt(self.avatar.css('top'), 10)
      };

      var move = _.bind(function (e) {
        var d = {x: e.pageX - m.x, y: e.pageY - m.y};
        var top = d.y + p.y;
        var left = d.x + p.x;
        if (top <= 0 && w.y + top >= 325) {
          self.avatarTop = top;
          self.avatar.css({top: top + 'px'});
        }
        if (left <= 0 && w.x + left >= 325) {
          self.avatarLeft = left;
          self.avatar.css({left: left + 'px'});
        }
      }, self);
      self.avatar.bind('mousemove', move);
      $(document).bind('mouseup', function (e) {
        self.avatar.unbind('mousemove', move);
        $(document).unbind('mouseup', arguments.callee);

        if (!self.avatarUploading) {
          return false;
        }

        if (self.avatarTop === undefined) {
          self.avatarTop = self.model.get('avatar_full').meta.top || 0;
        }
        if (self.avatarLeft === undefined) {
          self.avatarLeft = self.model.get('avatar_full').meta.left || 0;
        }
        if (self.avatarTop === self.model.get('avatar_full').meta.top &&
            self.avatarLeft === self.model.get('avatar_full').meta.left) {
          self.avatarUploading = false;
          return;
        }

        rest.put('/api/members/' + self.app.profile.member.username, {
          avatarLeft: self.avatarLeft,
          avatarTop: self.avatarTop
        }, function (err, data) {
          if (err) {
            self.avatarUploading = false;
            return mps.publish('flash/new', [{err: err, level: 'error',
                type: 'popup'}]);
          }
          self.model.get('avatar_full').meta.left = self.avatarLeft;
          self.model.get('avatar_full').meta.top = self.avatarTop;

          self.cropAvatar(function (err) {
            if (!err) {
              mps.publish('flash/new', [{message: 'Saved.', level: 'alert',
                  type: 'popup'}, true]);
            } else {
              mps.publish('flash/new', [{err: err, level: 'error',
                  type: 'popup'}]);
            }
            self.avatarUploading = false;
          });
        });

        return false;
      });

      return false;
    },

    avatarDragover: function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      this.avatarDropZone.addClass('dragging');
    },

    avatarDragout: function (e) {
      this.avatarDropZone.removeClass('dragging');
    },

    avatarDrop: function (e) {
      e.stopPropagation();
      e.preventDefault();

      this.avatarDropZone.removeClass('dragging');
      if (this.avatarUploading) {
        return false;
      }

      // Get the files, if any.
      var files = e.target.files || e.originalEvent.dataTransfer.files;
      if (files.length === 0) {
        return false;
      }

      this.avatarUploading = true;
      this.avatarSpin.start();
      this.avatarDropZone.addClass('uploading');

      var data = e.target.files ? null:
          new FormData(this.avatarForm.get(0));

      // Loop over each file, adding it the the display
      // and from data object, if present.
      _.each(files, function (file) {
        if (data && typeof file === 'object') {
          data.append('file', file);
        }
      });

      var opts = {
        wait: true,
        autoSubmit: true,
        modal: false,
        onError: _.bind(function (assembly) {
          this.avatarUploading = false;
          this.avatarSpin.stop();
          this.avatarDropZone.removeClass('uploading');

          mps.publish('flash/new', [{err: assembly.error + ': ' +
              assembly.message, level: 'error', type: 'popup'}]);
        }, this),
        onSuccess: _.bind(function (assembly) {
          if (assembly) {
            if (assembly.ok !== 'ASSEMBLY_COMPLETED') {
              this.avatarSpin.stop();
              this.avatarDropZone.removeClass('uploading');
              this.avatarUploading = false;
              mps.publish('flash/new', [{
                err: 'Upload failed. Please try again.',
                level: 'error',
                type: 'popup'
              }]);
              return;
            } if (_.isEmpty(assembly.results)) {
              this.avatarSpin.stop();
              this.avatarDropZone.removeClass('uploading');
              this.avatarUploading = false;
              mps.publish('flash/new', [{err: 'You must choose a file.',
                  level: 'error', type: 'popup'}]);
              return;
            }
          } else {
            this.avatarUploading = false;
            mps.publish('flash/new', [{err: 'No assembly found.',
                level: 'error', type: 'popup'}]);
            return;
          }

          rest.put('/api/members/' + this.app.profile.member.username,
              {assembly: assembly}, _.bind(function (err, data) {

            if (err) {
              this.avatarUploading = false;
              this.avatarSpin.stop();
              this.avatarDropZone.removeClass('uploading');

              mps.publish('flash/new', [{err: err, level: 'error',
                  type: 'popup'}]);
              return;
            }

            var avatar = assembly.results.avatar_full[0];
            this.model.set('avatar_full', avatar);
            var _w = 325, _h = 325;
            var w, h, o;
            w = _w;
            h = (avatar.meta.height / avatar.meta.width) * _w;
            if (h - _h >= 0) {
              o = 'top:' + (-(h - _h) / 2) + 'px;';
            } else {
              w = (avatar.meta.width / avatar.meta.height) * _h;
              h = _h;
              o = 'left:' + (-(w - _w) / 2) + 'px;';
            }
            this.avatar.hide();
            this.avatar.attr({src: avatar.ssl_url}).load(_.bind(function () {
              this.avatar.off('load');
              this.avatar.attr({
                width: w,
                height: h,
                style: o
              });
              this.avatar.fadeIn('slow');

              this.avatarSpin.stop();
              this.avatarDropZone.removeClass('uploading');

              this.removeAvatarButton.show();

              this.cropAvatar(_.bind(function (err) {
                if (!err) {
                  mps.publish('flash/new', [{message: 'Saved.', level: 'alert',
                      type: 'popup'}, true]);
                } else {
                  mps.publish('flash/new', [{err: err, level: 'error',
                      type: 'popup'}]);
                }
                this.avatarUploading = false;
              }, this));
            }, this));
          }, this));
        }, this)
      };

      // Use formData object if exists (dnd only)
      if (data) {
        opts.formData = data;
      }

      this.avatarForm.transloadit(opts);
      this.avatarForm.submit();

      return false;
    },

    cropAvatar: function (cb) {
      var avatar = this.model.get('avatar_full');
      var url = avatar ? avatar.ssl_url: null;
      if (!url) {
        return cb('avatar invalid');
      }

      this.avatarSpin.start();
      this.avatarDropZone.addClass('uploading');

      var side, reduce;
      var crop = {};
      avatar.meta.left = avatar.meta.left || 0;
      avatar.meta.top = avatar.meta.top || 0;
      if (avatar.meta.width > avatar.meta.height) {
        side = avatar.meta.height;
        reduce = avatar.meta.height / 325;
        var x1 = -avatar.meta.left * reduce;
        crop = {x1: x1, x2: x1 + side, y1: 0, y2: side};
      } else {
        side = avatar.meta.width;
        reduce = avatar.meta.width / 325;
        var y1 = -avatar.meta.top * reduce;
        crop = {x1: 0, x2: side, y1: y1, y2: y1 + side};
      }

      var opts = {
        wait: true,
        autoSubmit: true,
        modal: false,
        fields: {
          url: url,
          crop: JSON.stringify(crop)
        },
        onError: _.bind(function (assembly) {
          this.avatarSpin.stop();
          this.avatarDropZone.removeClass('uploading');
          return cb(assembly.error + ': ' + assembly.message);
        }, this),
        onSuccess: _.bind(function (assembly) {
          if (assembly) {
            if (assembly.ok !== 'ASSEMBLY_COMPLETED') {
              return cb('Avatar crop failed. Please try again.');
            } if (_.isEmpty(assembly.results)) {
              return cb('You must choose a file.');
            }
          } else {
            return cb('No assembly found.');
          }

          rest.put('/api/members/' + this.app.profile.member.username,
              {assembly: assembly}, _.bind(function (err, data) {

            this.avatarSpin.stop();
            this.avatarDropZone.removeClass('uploading');

            if (err) {
              return cb(err);
            }

            var avatar = assembly.results.avatar[0];
            var avatar_big = assembly.results.avatar_big[0];
            this.model.set('avatar', avatar);
            this.model.set('avatar_big', avatar_big);
            this.app.profile.member.avatar = avatar.ssl_url;
            this.app.profile.member.avatar_big = avatar_big.ssl_url;

            cb();

          }, this));
        }, this)
      };

      this.avatarForm2.transloadit(opts);
      this.avatarForm2.submit();

      return false;
    },

    removeAvatar: function (e) {
      if (this.avatarUploading) {
        return false;
      }
      this.avatarUploading = true;

      rest.put('/api/members/' + this.app.profile.member.username, {
        $unset: {avatar: 1, avatar_full: 1, avatar_big: 1}
      }, _.bind(function (err) {

        var flash = {type: 'popup'};
        if (err) {
          flash.err = err;
          flash.level = 'error';
        } else {
          flash.message = 'Saved.';
          flash.level = 'alert';

          this.avatar.attr({src: this.app.images.avatar_big}).load(
              _.bind(function () {
            this.avatar.off('load');
            this.avatar.attr({
              width: 325,
              height: 325
            }).css({
              top: 0,
              left: 0
            });

            this.removeAvatarButton.hide();
          }, this));
        }
        mps.publish('flash/new', [flash]);
        this.avatarUploading = false;
      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      $.fancybox(_.template(confirm)({
        message: 'Delete your profile forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {
        rest.delete('/api/members/' + this.app.profile.member.username,
            {}, _.bind(function (err, data) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error',
                type: 'popup'}]);
            return;
          }

          window.location.href = '/';
        }, this));
      }, this));

      return false;
    },

    clearAscents: function (e) {
      e.preventDefault();

      $.fancybox(_.template(confirm)({
        message: 'Clear all of your logs (work and "My Ascents") forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete all ticks.
        rest.delete('/api/ticks/all', {}, _.bind(function (err, data) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error',
                type: 'popup'}]);
            return;
          }

          $.fancybox.close();

          mps.publish('flash/new', [{
            message: 'You cleared your logs.',
            level: 'alert',
            type: 'popup'
          }, true]);

        }, this));
      }, this));

      return false;
    },

    // Help the user understand how to use Instagram.
    instagram: function () {
      $.fancybox(_.template(tip)({
        message: '<strong>You are connected to Instagram.</strong>' +
            ' We\'ll post photos of yours tagged @island_io, #islandio, or #weareisland' +
            ' to your feed.' +
            '<br /><br />' +
            'Tip: Want us to guess which crag you were at? Make sure location services' +
            ' (GPS) are enabled' +
            ' for Instagram on your phone and "Add to Photo Map" is set' +
            ' to "on" when posting.<br /><br />' +
            '&bull; <em>Directions for all iOS devices:</em> Select the ' +
            'Settings icon on the device. Go to Settings > Privacy > Location' +
            ' Services and toggle the setting for Instagram to “on”.<br /><br />' +
            '&bull; <em>Directions for Android phones:</em> Open the camera app.' +
            ' Select the Settings icon on the device. Scroll through the options' +
            ' and find GPS tag. Toggle the setting to “on”.',
        title: 'Island &hearts;\'s &nbsp;<img src="' + window.__s +
            '/img/instagram.png" width="24" height="24" />'
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      $('#tip_close').click(function (e) {
        $.fancybox.close();
      });
    }

  });
});
