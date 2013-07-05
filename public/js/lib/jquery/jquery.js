/*
 * jQuery wrapper.
 */

define([
  'lib/jquery/jquery.min'
], function () {

  jQuery.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    jQuery.each(a, function () {
      if (o[this.name] !== undefined) {
        if (!o[this.name].push)
          o[this.name] = [o[this.name]];
        o[this.name].push(this.value.trim() || '');
      } else o[this.name] = this.value.trim() || '';
    });
    return o;
  };

  return jQuery;
});
