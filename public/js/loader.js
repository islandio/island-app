/*
 * Global loader that enables content when page is ready
 */

define([
  // dependencies
  'jQuery',
  'Underscore',
  'mps'
], function ($, _, mps) {

  var modal;
  var target;
  var opts;
  var spinner;

  var Loader = function () {
    this.init();
  }

  Loader.prototype.init = function () {
    modal = $('#loader');
    opts = window._loader.opts;
    target = window._loader.target;
    spinner = window._loader.spinner;
    $(window).resize(_.debounce(_.bind(this.size, this), 50));
    $(window).resize();
  }

  Loader.prototype.start = function () {
    // spinner.spin(target);
    // modal.show();
  }

  Loader.prototype.stop = function () {
    // modal.fadeOut('fast');
    // spinner.stop();
  }

  Loader.prototype.size = function () {
    modal.height($(window).height());
    modal.width($(window).width());
  }

  return Loader;

});
