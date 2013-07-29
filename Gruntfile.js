module.exports = function (grunt) {

  // Use dir arg from command line
  var dir = grunt.option('dir') || 'build';

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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
  grunt.registerTask('build', 'requirejs');

};
