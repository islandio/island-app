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
    device: 'lib/device/device',
    mps: 'lib/minpubsub/minpubsub',
    Pusher: 'lib/pusher/pusher',
    Spin: 'lib/spin/spin',
    plugins: 'lib/jquery/plugins'
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
    device: {
      exports: 'device'
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
    plugins: {
      deps: ['jQuery']
    }
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
