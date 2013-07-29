define([
  'lib/minpubsub/minpubsub.src'
], function () {
  var mps = {
    subscribe: window.subscribe,
    unsubscribe: window.unsubscribe,
    publish: window.publish
  };
  delete window.subscribe;
  delete window.unsubscribe;
  delete window.publish;
  return mps;
});
