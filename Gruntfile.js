module.exports = function (grunt) {

  // Use dir arg from command line
  var dir = grunt.option('dir') || 'build';

  var publicjs = ['public/js/views/**/*.js', 'public/js/*.js'];
  var libjs = ['lib/**.js'];
  var islandjs = ['node_modules/island-*/*.js', 'node_modules/island-*/lib/*.js'];

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      all: publicjs.concat(libjs, islandjs),
      public: publicjs,
      lib: libjs,
      island: islandjs,
      options: {
        jshintrc: 'linters/.jshintrc'
      }
    },
    requirejs: {
      std: {
        options: {
          appDir: 'public',
          mainConfigFile: 'public/js/main.js',
          baseUrl: 'js',
          optimize: 'uglify2',
          inlineText: true,
          findNestedDependencies: true,
          preserveLicenseComments: false,
          wrap: true,
          name: 'main',
          include: 'lib/require/almond',
          dir: dir
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-requirejs');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.registerTask('build', 'requirejs');

};
