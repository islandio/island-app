/*
 * Post Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rpc',
  'util',
  'views/boiler/row',
  'models/post',
  'text!../../../templates/rows/post.html',
  'text!../../../templates/post.title.html',
  'text!../../../templates/video.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rpc, util, Row, Model, template, title, video,
      Comments, confirm) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'post'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Allow single rendering (no parent view)
      if (!options.parentView) {
        this.model = new Model(this.app.profile.content.page);
      }

      // Boiler init.
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate',
      'click .post-delete': 'delete',
      'click .post-feature': 'feature'
    },

    render: function (single, prepend) {

      function insert(item) {
        var src = util.https(item.data.cf_url || item.data.url);
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

      Row.prototype.render.call(this, single, prepend);

      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title(this.model.get('title') || this.model.get('key'));

        // Render title.
        this.title = _.template(title).call(this);
      }

      // gather images
      var images = [];
      if (this.model.get('medias'))
        _.each(this.model.get('medias'), _.bind(function (m) {
          switch (m.type) {
            case 'image':
              images.push(m.image);
              break;
            case 'video':
              this.video = m;
              images.push(m.poster);
              _.each(m.thumbs, function (t, i) {
                if (i !== 1) images.push(t);
              });
              break;
          }
        }, this));

      if (images.length === 0) {
        this.$('.post-mosaic').hide();
        this.$('.post-avatar').hide();
        return this;
      }

      var W = this.parentView ? 680: 1024;
      var H = this.parentView ? 383: 576;
      var P = 2;

      // handle the first item (the main img for this post)
      var data = images.shift();
      var ar = data.meta.width / data.meta.height;
      if (images.length === 0) {
        insert.call(this, {
          img: {
            width: W,
            height: W / ar,
            top: - (W / ar - H) / 2
          },
          div: {
            width: W,
            height: H,
            left: 0,
            top: 0
          },
          data: data
        });
        this.fancybox();
        return this;
      }

      // add the main image
      var img = ar < 1 ? {
        width: H,
        height: H / ar,
        top: - (H / ar - H) / 2
      }: {
        width: H * ar,
        height: H,
        left: - (H * ar - H) / 2
      };

      insert.call(this, {
        img: img,
        div: {
          width: H,
          height: H,
          left: 0,
          top: 0
        },
        data: data,
        video: this.video
      });

      var num = images.length;
      var mosaic = num > 3 ? _.groupBy(images, function (data, i) {
        return i < Math.ceil(num / 2) ? 1: 2;
      }): {1: images};
      var width = (W - H) / _.size(mosaic);

      _.each(mosaic, _.bind(function (images, i) {

        var column = {y: 0, items: []};

        // create the columns
        _.each(images, function (data, j) {

          var height = Math.round(width * data.meta.height / data.meta.width);
          column.items.push({
            img: {
              width: width,
              height: height
            },
            div: {
              width: width,
              height: height,
              left: H + (width * (i - 1)) + (i * P),
              top: column.y
            },
            data: data
          });
          column.y += height + P;

        });

        // determine the item heights
        var s = 0;
        var pad = column.items.length * P;
        while (Math.floor(column.y - pad) !== H && s < 1000) {
          ++s;
          _.each(column.items, function (item, i) {

            var delta = H - Math.floor(column.y - pad);
            var dir = Math.abs(delta) / (delta || 1);
            item.div.height += dir;
            for (var j=i+1; j < column.items.length; ++j)
              column.items[j].div.top += dir;
            column.y += dir; 

          });
        }

        // expand, shrink, center items
        _.each(column.items, function (item) {

          var ar = item.img.width / item.img.height;

          if (item.img.height < item.div.height) {
            item.img.height = item.div.height;
            item.img.width = ar * item.img.height;
          }

          item.img.top = - (item.img.height - item.div.height) / 2;
          item.img.left = - (item.img.width - item.div.width) / 2;

        });

        // finally, size and show the elements
        _.each(column.items, _.bind(function (item) {

          insert.call(this, item);

        }, this));

      }, this));

      // Handle fancybox.
      this.fancybox();

      return this;
    },

    setup: function () {
      Row.prototype.setup.call(this);

      if (!this.parentView) {

        // Set map view.
        mps.publish('map/fly', [this.model.get('location')]);
      }

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, type: 'post'});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      Row.prototype.destroy.call(this);
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
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
      if (this.video)
        this.$('.fancybox').click(_.bind(function (e) {
          e.stopPropagation();
          e.preventDefault();

          // Video params
          var params = {
            file: this.video.video.cf_url,
            image: this.video.poster.cf_url,
            width: '1024',
            height: '576',
            autostart: true,
            primary: 'flash',
            ga: {}
          };

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
      else
        this.$('.fancybox').fancybox(opts);
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Do you want to delete this post?',
        working: 'Working...'
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });
      
      // Refs.
      var overlay = $('.modal-overlay');

      // Setup actions.
      $('#confirm_cancel').click(function (e) {
        $.fancybox.close();
      });
      $('#confirm_delete').click(_.bind(function (e) {

        // Delete the post.
        rpc.delete('/api/posts/' + this.model.get('key'),
            {}, _.bind(function (err, data) {
          if (err) {

            // Oops.
            console.log('TODO: Retry, notify user, etc.');
            return;
          }

          // close the modal.
          $.fancybox.close();

        }, this));

        // Remove from UI.
        this.parentView._remove({id: this.model.id});

      }, this));

      return false;
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

    feature: function (e) {
      e.preventDefault();
      rpc.post('/api/posts/feature/' + this.model.get('key'),
          {}, _.bind(function (err, data) {
        if (err) return console.log(err);
      }, this));
    },

  });
});
