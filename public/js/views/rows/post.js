/*
 * Post Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/post.html'
], function ($, _, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'post matte'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {},

    render: function () {
      Row.prototype.render.call(this);

      var medias = this.model.get('medias');
      var first = medias.shift();
      var ar = first.image.meta.width / first.image.meta.height;
      this.$('img:nth-child(1)').css({
        width: 360 * ar,
        height: 360,
        left: 360 - 360 * ar,
      }).show();

      if (medias.length > 0) {

        var num = medias.length;
        var mosaic = _.groupBy(medias, function (m, i) {
          return i < Math.ceil(num / 2) ? 1: 2;
        });
        var width = 280 / _.size(mosaic);

        _.each(mosaic, _.bind(function (col, i) {
          _.each(col, _.bind(function (m, j) {

            console.log(m.image.meta.width / m.image.meta.height)
            var h = width * m.image.meta.height / m.image.meta.width;
            var x = 360 + (280 * (i - 1));
            this.$('img:nth-child(' + (Number(i) + 1) + ')').css({
              width: width,
              height: h,
              left: x,
            }).show();

          }, this));
        }, this));

      }

    },

  });
});