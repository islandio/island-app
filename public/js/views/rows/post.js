/*
 * Post View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/post',
  'text!../../../templates/rows/post.html',
  'text!../../../templates/post.title.html',
  'text!../../../templates/video.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html',
  'device'
], function ($, _, Backbone, mps, rest, util, Model, template, title, videoTemp,
      Comments, confirm) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'post'};
      if (this.model) attrs.id = this.model.id;
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);
      this.videoTemp = _.template(videoTemp);

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate',
      'click .post-delete': 'delete'
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
      }

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + (this.model.get('title')
            || new Date(this.model.get('created')).format('mmm d, yyyy')));
        this.title = _.template(title).call(this);
      }

      // Group medias by type.
      //   - images can all be in one mosaic
      //   - each video set needs its own mosaic
      //     - (set = three vids of diff quality for each uploaded vid)
      var mosaics = [];
      _.each(this.model.get('medias'), _.bind(function (m) {
        switch (m.type) {
          case 'image':
            var o = _.find(mosaics, function (o) {
              return o.type === 'image';
            });
            if (!o) {
              o = {type: 'image', images: []};
              mosaics.push(o);
              o.id = this.model.id; // will be uniq cause only one photo mosaic
            }
            o.images.push(m.image);
            break;
          case 'video':
            if (m.quality !== 'hd') {
              return;
            }
            var o = {type: 'video', images: []};
            o.images.push(m.poster);
            _.each(m.thumbs, function (t, i) {
              if (i !== 1) {
                o.images.push(t);
              }
            });
            o.id = m.video.original_id; // original_id is uniq for vid set
            mosaics.push(o);
            break;
        }
      }, this));

      var fancyOpts = {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        nextClick: true,
        padding: 0
      };

      // Create a mosaic for each group.
      _.each(mosaics, _.bind(function (o) {
        var el = this.$('.image-mosaic[data-id="' + o.id + '"]');
        util.createImageMosaic(o.images, el.width(), el.height(), _.bind(function (item) {
          var src = item.data.ssl_url || item.data.url;
          var anc = $('<a class="fancybox" data-type="' + o.type + '" rel="g-' + o.id
              + '" href="' + src + '">');
          var div = $('<div class="image-mosaic-wrap">').css(item.div).appendTo(anc);
          var img = $('<img src="' + src + '" />').css(item.img).wrap(
              $('<a class="fancybox" rel="g-' + o.id + '">')).appendTo(div);
          if (o.type === 'video' && item.first) {
            var s = 120;
            var play = $('<img src="' + __s + '/img/play.png" class="image-mosaic-play"'
                + ' width="' + s + '" height="' + s + '" />');
            play.appendTo(div);
            if (item.data.trailer) {
              var subtext = $('<span class="image-mosaic-play-text">(trailer)</span>');
              subtext.appendTo(div);
              play.addClass('trailer');
            }
          }
          anc.appendTo(el);
        }, this),

        // Mosaic is done and attached to dom.
        _.bind(function () {

          function getVideo(quality) {
            return _.find(this.model.get('medias'), function (m) {
              return m.type === 'video' && m.quality === quality
                  && m.video.original_id === o.id;
            });
          }

          // Setup click handler.
          switch (o.type) {
            case 'image':
              this.$('.fancybox[data-type="image"]').fancybox(fancyOpts);
              break;
            case 'video':
              this.$('.fancybox[data-type="video"][rel="g-' + o.id + '"]')
                  .click(_.bind(function (e) {
                e.stopPropagation();
                e.preventDefault();

                var iphone = getVideo.call(this, 'iphone');
                var ipad = getVideo.call(this, 'ipad');
                var hd = getVideo.call(this, 'hd');

                // Video params
                var params = {
                  width: el.width().toString(),
                  height: el.height().toString(),
                  autostart: true,
                  primary: 'flash',
                  ga: {},
                  sharing: {
                    link: window.location.protocol + '//'
                        + window.location.host + '/' + this.model.get('key'),
                    code: "<iframe width='100%' height='100%' src='//"
                        + window.location.host + "/embed/"
                        + ipad.video.id + "' frameborder='0'></iframe>"
                  }
                };

                // Desktops and mobile tablets.
                if (!device.mobile() || (device.mobile() && device.tablet())) {
                  _.extend(params, {
                    playlist: [{
                      image: hd.poster.ssl_url,
                      sources: [{
                        file: device.ios() ? ipad.video.ios_url: ipad.video.ssl_url,
                        label: '1200k'
                      },
                      {
                        file: device.ios() ? hd.video.ios_url: hd.video.ssl_url,
                        label: '4000k'
                      }]
                    }]
                  });

                // Mobile phones, ipod, etc.
                } else {
                  _.extend(params, {
                    playlist: [{
                      image: iphone.poster.ssl_url,
                      sources: [{
                        file: device.ios() ? iphone.video.ios_url: iphone.video.ssl_url,
                        label: '700k'
                      },
                      {
                        file: device.ios() ? ipad.video.ios_url: ipad.video.ssl_url,
                        label: '1200k'
                      }]
                    }]
                  });
                }

                // if (this.parentView) {
                //   // Place the video in the fancybox.
                //   $.fancybox(this.videoTemp.call(this, {
                //       data: hd, width: 1024, height: 576}), fancyOpts);
                // } else {
                  // Lay the video over the mosaic.
                  $(this.videoTemp.call(this, {data: hd, width: el.width(), height: el.height()}))
                      .appendTo(this.$('.image-mosaic[data-id="' + o.id + '"]'));
                  _.extend(params, {
                    width: el.width().toString(),
                    height: el.height().toString()
                  });
                  this.$('span.image-mosaic-play-text').hide();
                // }
                
                // Finally, play the video.
                jwplayer('video-' + o.id).setup(params);

                return false;
              }, this));
              break;
          }
        }, this));
      }, this));

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Set map view.
      if (!this.parentView) {
        mps.publish('map/fly', [this.model.get('location')]);
      }

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'post',
        hideInput: true
      });

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this post forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the post.
        rest.delete('/api/posts/' + this.model.get('key'),
            {}, _.bind(function (err, data) {
          if (err) {
            return console.log(err);
          }

          // Close the modal.
          $.fancybox.close();

          // Go home if single view.
          if (!this.parentView) {
            this.app.router.navigate('/', {trigger: true, replace: true});
          }

        }, this));
      }, this));

      return false;
    },

    when: function () {
      if (!this.model.get('created')) return;
      if (!this.time) {
        this.time = $('#time_' + this.model.id);
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

    // insert HTML to create anchor tags, strong @'s etc
    styleBody: function(body) {
      // Strong names
      return body.replace(/([@#][^\s:]+)/g, '<strong>$1</strong>')
          // Add anchors
          .replace(/(http[^\s\)]+)/g, '<a href="$1">$1</a>')
    }

  });
});
