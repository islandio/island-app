// Wrapper for swfobject.

define(['lib/swfobject/swfobject.min'], function () {
  var swfobject = window.swfobject;
  delete window.swfobject;
  return swfobject;
});
