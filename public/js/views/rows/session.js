/*
 * Session View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/session',
  'views/rows/tick',
  'text!../../../templates/rows/session.html',
  'text!../../../templates/rows/session.activity.html',
  'text!../../../templates/session.title.html',
  'text!../../../templates/confirm.html',
  'text!../../../templates/video.html',
  'views/minimap',
  'device'
], function ($, _, Backbone, mps, rest, util, Model, Tick, template,
      activityTemp, title, confirm, video, MiniMap) {
  return Backbone.View.extend({

    ticks: [],

    attributes: function () {
      var attrs = {class: 'session'};
      if (this.model) {
        attrs.id = this.model.id;
      }
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);

      // collect all the media for this session to be displayed at the end
      // of the session
      this.media = [];
      var actions = this.model.get('actions');
      if (actions) {
        _.each(actions, _.bind(function(a) {
          _.each(a.ticks, _.bind(function(t) {
            if (t.medias_cnt > 0) this.media = this.media.concat(t.medias);
          }, this));
        }, this));
      }

      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);
      this.activityTemp = _.template(activityTemp);
      this.subscriptions = [];

      // // Socket subscriptions
      // this.app.rpc.socket.on('tick.new', _.bind(this.collect, this));
      // this.app.rpc.socket.on('tick.removed', _.bind(this._remove, this));

      this.on('rendered', this.setup, this);
      return this;
    },

    events: {
      'click .navigate': 'navigate'
    },

    render: function () {
      this.$el.html(this.template.call(this));
      if (this.parentView) {
        this.$el.prependTo(this.parentView.$('.event-right'));
      } else {
        this.$el.appendTo(this.wrap);
        this.$el.attr('id', this.model.id);
      }

      // Render each tick as a view.
      _.each(this.$('.tick'), _.bind(function (el) {
        el = $(el);
        var action = _.find(this.model.get('actions'), function (a) {
          return a.id === el.data('aid');
        });
        var data = _.find(action.ticks, function (t) {
          return t.id === el.attr('id');
        });
        this.ticks.push(new Tick({parentView: this, el: el, model: data},
            this.app).render());
      }, this));

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title('Island | ' + this.model.get('author').displayName
            + ' - ' + this.model.formatName());

        // Render title.
        this.title = _.template(title).call(this);
      }

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

      this.video = {};

      util.createImageMosaic(this.media
          , this.parentView ? 561 : 1024
          , this.parentView ? 316 : 576
          , this.video
          , _.bind(insert, this));

      if (this.media && this.media.length === 0) this.$('.post-media').hide();

      // Handle fancybox.
      this.fancybox();

      this.trigger('rendered');
      return this;
    },

    setup: function () {

      // Set map view.
      if (!this.parentView) {
        mps.publish('map/fly', [this.model.get('crag').location]);
      }

      // Render map.
      this.map = new MiniMap(this.app, {
        el: this.$('.mini-map'),
        location: this.model.get('crag').location
      }).render();

      // Handle time.
      // this.timer = setInterval(_.bind(this.when, this), 5000);
      // this.when();
    },

    // Collect a tick.
    collect: function (data) {
      if (data.session_id === this.model.id) {
        var tick = this.renderTick(data);
        var activity = this.$('.session-activity[data-type="' + data.type + '"]');
        if (activity.length > 0) {
          $(tick).appendTo($('.session-ticks', activity));
        } else {
          data.action.ticks = [data];
          activity = this.renderActivity(data.action);
          $(activity).insertAfter(this.$('.session-activity').last());
        }
        var action = _.find(this.model.get('actions'), function (a) {
          return a.id === data.action.id;
        });
        if (!action) {
          this.model.get('actions').push(data.action);
        } else {
          action.ticks = _.reject(action.ticks, function (t) {
            return t.id === data.id;
          });
          action.ticks.push(data);
        }
      }
    },

    // Remove a tick.
    _remove: function (data) {
      var t = this.$('li#' + data.id);
      var a = t.closest('.session-activity');
      var list = $('.session-ticks', a);
      t.slideUp('fast', _.bind(function () {
        t.remove();
        if (list.children().length === 0) {
          a.remove();
        }
      }, this));
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.each(this.ticks, function (t) {
        t.destroy();
      });
      this.map.destroy();
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
        this.time = $('#time_' + this.model.id);
      }
      this.time.text(util.getRelativeTime(this.model.get('updated')));
    },

    renderActivity: function (a) {
      return this.activityTemp.call(this, {a: a});
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

    videoFor: function (quality) {
      return _.find(this.media, function (m) {
        return m.type === 'video' && m.quality === quality;
      });
    }

  });
});
