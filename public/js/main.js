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
    balanced: 'libs/balanced/balanced',
    Spin: 'libs/spin/spin',
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
    balanced: {
      exports: 'balanced'
    },
    Spin: {
      exports: 'Spin'
    },
  }
});

// Application entry point:
require(['app'], function (app) {
  app.init();
});
