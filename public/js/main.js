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
    mps: 'lib/minpubsub/minpubsub',
    device: 'lib/device/device.src',
    Spin: 'lib/spin/spin',
    Picker: 'lib/pickadate/picker',
    Pickadate: 'lib/pickadate/picker.date',
    Skycons: 'lib/skycons/skycons',
    Instafeed: 'lib/instafeed/instafeed.min',
    Share: 'lib/share/share.min',
    plugins: 'lib/jquery/plugins',
    d3: 'lib/d3/d3',
    d3Tip: 'lib/d3/d3-tip'
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
    Share: {
      exports: 'Share'
    },
    plugins: {
      deps: ['jQuery']
    },
    GradeConverter: {
      exports: 'GradeConverter',
      deps: ['Underscore']
    },

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
