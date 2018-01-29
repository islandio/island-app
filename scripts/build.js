#!/usr/bin/env node
/*
 * build.js: Build the frontend.
 *
 */

// Arguments
var optimist = require('optimist');
var util = require('util');
var clc = require('cli-color');
var _s = require('underscore.string');
var argv = optimist
    .usage('Build app frontend.\nUsage: $0')
    .describe('help', 'Get help')
    .argv;

if (argv._.length === 0) {
  util.log(clc.red('Error: Expected a <app_directory> argument.'));
  optimist.showHelp();
  process.exit(1);
}

if (argv.help) {
  optimist.showHelp();
  process.exit(1);
}

var rel = argv._[0];
if (!_s.endsWith(rel, '/')) rel += '/';

// Module Dependencies
var fs = require('fs-extra');
var exec = require('child_process').exec;
var Step = require('step');
var boots = require('@islandio/boots');

// Build vars.
var dir = 'build';
var pack = require('../package.json');
var nv = pack.version

Step(
  function () {
    // Run grunt tasks from Gruntfile.js
    util.log(clc.blackBright('Starting statics build for version ') +
        clc.underline(clc.green(nv)) + clc.blackBright(' ...'));
    exec('grunt build --dir=' + dir, this);
  },
  function (err) {
    boots.error(err);
    fs.renameSync(rel + dir + '/js/main.js', rel + dir + '/min.js');
    fs.renameSync(rel + dir + '/js/lib/store/store.min.js', rel + dir + '/store.min.js');
    fs.removeSync(rel + dir + '/js');
    fs.mkdirSync(rel + dir + '/js');
    fs.renameSync(rel + dir + '/min.js', rel + dir + '/js/min.js');
    fs.renameSync(rel + dir + '/store.min.js', rel + dir + '/js/store.min.js');
    fs.removeSync(rel + dir + '/templates');

    var min = fs.readFileSync(rel + dir + '/js/min.js', 'utf8');
    var banner = '/*\n * ' + pack.name + ' v' + nv + '\n */\n';
    var vvar = 'var __s = "' + pack.builds.cloudfront + '/' + nv + '";';
    fs.writeFileSync(rel + dir + '/js/min.js', banner + vvar + min);

    this();
  },
  function (err) {
    boots.error(err);

    // Done.
    util.log(clc.green('Build complete!'));
    process.exit(0);
  }
);
