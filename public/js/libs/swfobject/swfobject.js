// Wrapper for swfobject.

define(['libs/swfobject/swfobject.min'], function () {
  var swfobject = window.swfobject;
  delete window.swfobject;
  return swfobject;
});