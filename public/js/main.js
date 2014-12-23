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
    device: 'lib/device/device.src',
    Spin: 'lib/spin/spin',
    Picker: 'lib/pickadate/picker',
    Pickadate: 'lib/pickadate/picker.date',
    Skycons: 'lib/skycons/skycons',
    Instafeed: 'lib/instafeed/instafeed.min',
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
    mps: {
      deps: ['jQuery', 'Underscore'],
      exports: 'mps'
    },
    Spin: {
      exports: 'Spin'
    },
    Picker: {
      deps: ['jQuery'],
    },
    Pickadate: {
      deps: ['Picker'],
    },
    Skycons: {
      exports: 'Skycons'
    },
    Instafeed: {
      exports: 'Instafeed'
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
