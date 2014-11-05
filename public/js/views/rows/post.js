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
], function ($, _, Backbone, mps, rest, util, Model, template, title, video,
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

      function insert(item) {
        var src = item.data.ssl_url || item.data.url;
        var anc = $('<a class="fancybox" rel="g-' + this.model.id + '" href="'
            + src + '">');
        var div = $('<div class="post-mosaic-wrap">').css(item.div).appendTo(anc);
        var img = $('<img src="' + src + '" />').css(item.img).wrap(
            $('<a class="fancybox" rel="g-'
            + this.model.id + '">')).appendTo(div);
        if (item.video) {
          var play = $('<img src="' + __s + '/img/play.png" class="post-mosaic-play"'
              + ' width="160" height="160" />');  
          play.appendTo(div);
          if (this.model.get('product') && this.model.get('product').sku) {
            var subtext =
                $('<span class="post-mosaic-play-text">(trailer)</span>');
            subtext.appendTo(div);
            play.addClass('trailer');
          }
        }
        anc.appendTo(this.$('.post-mosaic'));
      }

      // Render content
      this.$el.html(this.template.call(this));
      if (this.parentView)
        this.$el.prependTo(this.parentView.$('.event-right'));
      else this.$el.appendTo(this.wrap);

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + (this.model.get('title')
            || new Date(this.model.get('created')).format('mmm d, yyyy')));

        // Render title.
        this.title = _.template(title).call(this);
      }

      // Trigger setup.
      this.trigger('rendered');

      this.video = {};

      var media = this.model.get('medias');
      util.createImageMosaic(media
          , this.parentView ? 561 : 1024
          , this.parentView ? 316 : 576
          , this.video
          , _.bind(insert, this));

      if (media && media.length === 0) this.$('.post-media').hide();

      // Handle fancybox.
      this.fancybox();

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
        type: 'post'
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

    fancybox: function () {

      // View options.
      var opts = {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        nextClick: true,
        padding: 0
      };

      // Bind anchor clicks.
      if (!_.isEmpty(this.video)) {
        this.$('.fancybox').click(_.bind(function (e) {
          e.stopPropagation();
          e.preventDefault();

          var iphone = this.videoFor('iphone');
          var ipad = this.videoFor('ipad');
          var hd = this.videoFor('hd');

          // Video params
          var params = {
            width: '1024',
            height: '576',
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

          if (this.parentView) {

            // Place the video in the fancybox.
            $.fancybox(_.template(video)({
                data: this.video, width: 1024, height: 576}), opts);

          } else {

            // Lay the video over the mosaic.
            $(_.template(video)({data: this.video, width: 1024, height: 576}))
                .appendTo(this.$('.post-mosaic'));
            _.extend(params, {
              width: '1024',
              height: '576'
            });
            this.$('span.post-mosaic-play-text').hide();

          }
          
          // Finally, play the video.
          jwplayer('video-' + this.video.id).setup(params);

          return false;
        }, this));
      } else {
        this.$('.fancybox').fancybox(opts);
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

    videoFor: function (quality) {
      return _.find(this.model.get('medias'), function (m) {
        return m.type === 'video' && m.quality === quality;
      });
    },

    when: function () {
      if (!this.model.get('created')) return;
      if (!this.time)
        this.time = this.$('time.created:first');
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
