/*
 * Member model
 */

define([
  'Backbone',
  'util'
], function (Backbone, util) {
  return Backbone.Model.extend({

    _path: 'api/members/',

    desc: function () {
      return util.formatText(this.get('description'));
    }

    // Return an img tag for the profile banner.
    // banner: function () {
    //   var image = this.get('image');

    //   var _width = 640;
    //   var _height = 288;
    //   var width, height;
    //   var top = 'top:0;';
    //   var left = 'left:0;';
      
    //   width = _width;
    //   height = (image.meta.height / image.meta.width) * _width;
    //   if (height - _height >= 0)
    //     top = 'top:' + (image.meta.top !== undefined ?
    //         image.meta.top : (-(height - _height) / 2)) + 'px;';
    //   else {
    //     width = (image.meta.width / image.meta.height) * _height;
    //     height = _height;
    //     left = 'left:' + (image.meta.left !== undefined ?
    //         image.meta.left : (-(width - _width) / 2)) + 'px;';
    //   }
    //   return {width: width, height: height, style: top + left};

    // }

  });
});
