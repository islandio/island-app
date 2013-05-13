/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({
  
  // Library paths:
  paths: {
    jQuery: 'libs/jquery/jquery',
    Underscore: 'libs/underscore/underscore',
    Backbone: 'libs/backbone/backbone',
    mps: 'libs/minpubsub/minpubsub',
    Pusher: 'libs/pusher/pusher',
    Spin: 'libs/spin/spin',
    swfobject: 'libs/swfobject/swfobject',
  },
  
  // Dependency mapping:
  shim: {
    Underscore: {
      exports: '_'
    },
    Backbone: {
      deps: ['jQuery', 'Underscore'],
      exports: 'Backbone'
    },
    mps: {
      deps: ['jQuery', 'Underscore'],
      exports: 'mps'
    },
    Pusher: {
      exports: 'Pusher'
    },
    Spin: {
      exports: 'Spin'
    },
    swfobject: {
      exports: 'swfobject'
    },
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});
