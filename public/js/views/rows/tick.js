/*
 * Tick View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/tick',
  'text!../../../templates/rows/tick.html',
  'text!../../../templates/tick.title.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html',
  'views/minimap',
  'views/session.new',
  'text!../../../templates/video.html',
  'Skycons',
  'device'
], function ($, _, Backbone, mps, rest, util, Model, template, title, Comments,
      confirm, MiniMap, NewSession, videoTemp, skycons) {
  return Backbone.View.extend({

    tagName: 'li',

    attributes: function () {
      var attrs = {class: 'tick'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);
      this.videoTemp = _.template(videoTemp);
      this.subscriptions = [];

      // Socket subscriptions
      _.bindAll(this, 'onRemoved');
      this.app.rpc.socket.on('tick.removed', this.onRemoved);
      // this.app.rpc.socket.on('media.new', _.bind(function (data) {}, this));
      // this.app.rpc.socket.on('media.removed', _.bind(function (data) {}, this));

      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .tick-edit': 'edit'
    },

    render: function () {

      // Render content
      if (this.options.el) {
        this.setElement(this.options.el);
      }
      this.$el.html(this.template.call(this));
      if (!this.options.el) {
        if (this.parentView) {
          this.$el.prependTo(this.parentView.$('.event-right'));
        } else {
          this.$el.attr('id', this.model.id);
          this.$el.appendTo(this.wrap);
          this.$el.addClass('single');
        }
      }
      if (this.app.profile.member && this.model.get('author').id
          === this.app.profile.member.id) {
        this.$el.addClass('own');
      }
      if (this.model.get('sent')) {
        this.$el.addClass('sent');
      }

      // Render title if single
      if (!this.parentView) {
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.get('ascent').name);
        this.title = _.template(title).call(this);

        // Handle weather icon.
        _.defer(_.bind(function () {
          var weather = this.model.get('weather');
          var hourly = this.model.get('time') !== undefined ?
              weather.hourly(this.model.get('time') / 60): null;
          var w = hourly || weather.daily();
          if (w && w.icon) {
            this.skycons = new Skycons({'color': '#666'});
            var iconName = w.icon.replace(/-/g, '_').toUpperCase();
            this.skycons.add('crag_weather', w.icon);
            this.skycons.play();
          }
        }, this));
      }

      if (this.options.medialess) {
        this.trigger('rendered');
        return this;
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
            if (this.parentView && this.parentView.parentView
                && this.parentView.$('.session-ticks').length > 0) {
              s = 80;
            }
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
        mps.publish('map/fly', [this.model.get('crag').location]);
      }

      // Render map.
      if (!this.options.mapless && this.$('.mini-map').length !== 0) {
        this.map = new MiniMap(this.app, {
          el: this.$('.mini-map'),
          location: this.model.get('ascent').location
        }).render();
      }

      // Render comments.
      if (!this.options.commentless) {
        this.comments = new Comments(this.app, {
          parentView: this,
          type: 'tick',
          hideInput: true
        });
      }

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();

      // Handle sizing.
      if (!this.parentView && this.$('.leftside').height()
          < this.$('.rightside').height()) {
        this.$('.leftside').height(this.$el.height() - 60);
      }
    },

    onRemoved: function (data) {
      if (!this.parentView && data.id === this.model.id) {
        this.app.router.tick(this.model.get('key'));
      }
    },

    destroy: function () {
      this.app.rpc.socket.removeListener('tick.removed', this.onRemoved);
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.map) {
        this.map.destroy();
      }
      if (this.comments) {
        this.comments.destroy();
      }
      this.undelegateEvents();
      this.stopListening();
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    when: function () {
      if (!this.model.get('updated')) return;
      if (!this.time) {
        this.time = this.$('#time_' + this.model.id);
      }
      this.time.text(util.getRelativeTime(this.model.get('updated')));
    },

    edit: function (e) {
      e.preventDefault();
      new NewSession(this.app, {
        tick: this.model.attributes,
        crag_id: this.model.get('crag_id'),
        ascent_id: this.model.get('ascent').id
      }).render();
    }

  });
});
