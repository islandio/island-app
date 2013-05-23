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
    Modernizr: 'libs/modernizr/modernizr',
    mps: 'libs/minpubsub/minpubsub',
    Pusher: 'libs/pusher/pusher',
    Spin: 'libs/spin/spin',
    swfobject: 'libs/swfobject/swfobject',
    // cartodb: 'libs/cartodb/cartodb'
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
    Modernizr: {
      exports: 'Modernizr'
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
    // cartodb: {
    //   exports: 'cartodb'
    // },
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});
