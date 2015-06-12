/*
 * Media Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'util',
  'text!../../../templates/rows/media.html',
  'text!../../../templates/video.html',
  'device'
], function ($, _, Row, mps, rest, util, template, videoTemp) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'media'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      this.videoTemp = _.template(videoTemp);

      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click .navigate': 'navigate',
      'click .info-share': function () {
        mps.publish('modal/share/open', [{pathname: this.model.get('path')}]);
      },
    },

    setup: function () {
      this.$('.tooltip').tooltipster({delay: 300, multiple: true});

      // Group medias by type.
      //   - images can all be in one mosaic
      //   - each video set needs its own mosaic
      //     - (set = three vids of diff quality for each uploaded vid)
      var mosaics = [];
      _.each(this.model.get('action').medias, _.bind(function (m) {
        var o;
        switch (m.type) {
          case 'image':
            o = _.find(mosaics, function (o) {
              return o.type === 'image';
            });
            if (!o) {
              o = {type: 'image', images: []};
              mosaics.push(o);
              o.id = this.model.get('action').id; // will be uniq cause only one photo mosaic
            }
            o.images.push(m.image);
            break;
          case 'video':
            if (m.quality !== 'hd') {
              return;
            }
            o = {type: 'video', images: []};
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
          var anc = $('<a class="fancybox" data-type="' + o.type + '" rel="g-' + o.id +
              '" href="' + src + '">');
          var div = $('<div class="image-mosaic-wrap">').css(item.div).appendTo(anc);
          var img = $('<img src="' + src + '" />').css(item.img).wrap(
              $('<a class="fancybox" rel="g-' + o.id + '">')).appendTo(div);
          if (o.type === 'video' && item.first) {
            var s = 80;
            var play = $('<img src="' + __s + '/img/play.png" class="image-mosaic-play"' +
                ' width="' + s + '" height="' + s + '" />');
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
            return _.find(this.model.get('action').medias, function (m) {
              return m.type === 'video' && m.quality === quality &&
                  m.video.original_id === o.id;
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
                    link: window.location.protocol + '//' +
                        window.location.host + '/' + this.model.get('path'),
                    code: "<iframe width='100%' height='100%' src='//" +
                        window.location.host + "/embed/" +
                        ipad.video.id + "' frameborder='0'></iframe>"
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

                // Lay the video over the mosaic.
                $(this.videoTemp.call(this, {data: hd, width: el.width(), height: el.height()}))
                    .appendTo(this.$('.image-mosaic[data-id="' + o.id + '"]'));
                _.extend(params, {
                  width: el.width().toString(),
                  height: el.height().toString()
                });
                this.$('span.image-mosaic-play-text').hide();

                jwplayer('video-' + o.id).setup(params);

                return false;
              }, this));
              break;
          }
        }, this));
      }, this));

      return Row.prototype.setup.call(this);
    },

    _remove: function (cb) {
      this.$el.fadeOut('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    when: function () {
      if (!this.model || !this.model.get('created')) {
        return;
      }
      if (!this.time) {
        this.time = this.$('time.created');
      }
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
