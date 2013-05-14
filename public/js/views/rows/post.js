/*
 * Post Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/post.html',
  'views/lists/comments'
], function ($, _, Row, template, Comments) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'post'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {},

    render: function (single, prepend) {

      function insert(item) {
        var div = $('<div class="post-mosaic-wrap">').css(item.div);
        var img = $('<img src=' + (item.data.cf_url || item.data.url)
            + ' />').css(item.img).appendTo(div);
        div.appendTo(this.$('.post-mosaic'));
      }

      Row.prototype.render.call(this, single, prepend);

      // gather images
      var images = [];
      if (this.model.get('medias'))
        _.each(this.model.get('medias'), function (m) {
          switch (m.type) {
            case 'image':
              images.push(m.image);
              break;
            case 'video':
              images.push(m.poster);
              _.each(m.thumbs, function (t, i) {
                if (i !== 1) images.push(t);
              });
              break;
          }
        });

      if (images.length === 0) {
        this.$('.post-mosaic').hide();
        return;
      }

      var W = 640;
      var H = 360;
      var P = 2;

      // handle the first item (the main img for this post)
      var data = images.shift();
      var ar = data.meta.width / data.meta.height;
      if (images.length === 0)
        return insert.call(this, {
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

      // add the main image
      insert.call(this, {
        img: {
          width: H * ar,
          height: H,
          left: - (H * ar - H) / 2
        },
        div: {
          width: H,
          height: H,
          left: 0,
          top: 0
        },
        data: data
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

    },

    setup: function () {
      Row.prototype.setup.call(this);

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, reverse: true});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      Row.prototype.destroy.call(this);
    },

  });
});