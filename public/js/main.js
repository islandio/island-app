/*
 * Bootstrap
 */

// Application configuration used for local dev
// and our GruntJS build process.
require.config({

  // Library paths:
  paths: {
    jQuery: 'lib/jquery/jquery',
    Underscore: 'lib/underscore/underscore.src',
    UnderscoreString: 'lib/underscore/underscore.string.src',
    Backbone: 'lib/backbone/backbone',
    Modernizr: 'lib/modernizr/modernizr.src',
    mps: 'lib/minpubsub/minpubsub',
    Pusher: 'lib/pusher/pusher',
    Spin: 'lib/spin/spin',
    swfobject: 'lib/swfobject/swfobject.min',
    plugins: 'lib/jquery/plugins',
    // cartodb: 'lib/cartodb/cartodb'
  },

  // Dependency mapping:
  shim: {
    Underscore: {
      exports: '_'
    },
    UnderscoreString: {
      deps: ['Underscore']
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
    plugins: {
      deps: ['jQuery']
    },
    // cartodb: {
    //   exports: 'cartodb'
    // },
  }
});

// Application entry point:
require([
  'app',
  'UnderscoreString',
  'plugins'
], function (app) {
  window.__s = window.__s || '';
  app.init();
});
