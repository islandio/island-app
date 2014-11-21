#!/usr/bin/env node
/*
 * ship.js: Ship app to production.
 *
 */

// Arguments
var optimist = require('optimist');
var util = require('util');
var clc = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var argv = optimist
    .usage('Build and deploy app.\nUsage: $0')
    .describe('help', 'Get help')
    .describe('push', 'Push to Elastic Beanstalk')
      .boolean('push')
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
if (!_.endsWith(rel, '/')) rel += '/';

// Module Dependencies
var sys = require('sys');
var fs = require('fs');
var walk = require('walk');
var knox = require('knox');
var exec = require('child_process').exec;
var wrench = require('wrench');
var request = require('request');
var Step = require('step');
var boots = require(rel + 'boots');

// Build vars.
var dir = 'build';
var pack = require('./package.json');
var bv = _.strLeftBack(pack.version, '.');
var lv = parseInt(_.strRightBack(pack.version, '.')) + 1;
var nv = bv + '.' + String(lv);

// AWS credentials.
var acf = fs.readFileSync(rel + '.aws/aws_credential_file', 'utf8');
var client = knox.createClient({
  key: acf.match(/AWSAccessKeyId=(.+)/)[1],
  secret: acf.match(/AWSSecretKey=(.+)/)[1],
  bucket: pack.builds.bucket
});

Step(
  function () {

    // Run grunt tasks from Gruntfile.js
    util.log(clc.blackBright('Starting statics build for new version ')
        + clc.underline(clc.green(nv)) + clc.blackBright(' ...'));
    exec('grunt build --dir=' + dir, this);
  },
  function (err) {
    boots.error(err);
    fs.renameSync(rel + dir + '/js/main.js', rel + dir + '/min.js');
    fs.renameSync(rel + dir + '/js/lib/store/store.min.js', rel + dir + '/store.min.js');
    wrench.rmdirSyncRecursive(rel + dir + '/js');
    fs.mkdirSync(rel + dir + '/js');
    fs.renameSync(rel + dir + '/min.js', rel + dir + '/js/min.js');
    fs.renameSync(rel + dir + '/store.min.js', rel + dir + '/js/store.min.js');
    wrench.rmdirSyncRecursive(rel + dir + '/templates');
    
    var min = fs.readFileSync(rel + dir + '/js/min.js', 'utf8');
    var banner = '/*\n * ' + pack.name + ' v' + nv + '\n */\n';
    var vvar = 'var __s = "' + pack.builds.cloudfront + '/' + nv + '";';
    fs.writeFileSync(rel + dir + '/js/min.js', banner + vvar + min);

    this();
  },
  function (err) {
    boots.error(err);

    // Walk the build dir.
    var walker = walk.walk(rel + dir, {
      followLinks: false,
      filters: []
    });

    walker.on('file', function (root, file, next) {
      if (file.name === '.DS_Store') return next();

      // Build the path for S3.
      var path = _.strRight(root, rel + dir + '/');
      path = path === root ? nv: nv + '/' + path;
      var key = path + '/' + file.name;

      // Upload to S3.
      client.putFile(root + '/' + file.name, key, {'x-amz-acl': 'public-read'},
          function (err, res) {
        boots.error(err);
        res.resume();
        next();
      });
      util.log(clc.blackBright('sending ') + clc.cyan(key) + clc.blackBright(' to S3.'));

    });
    walker.on('end', this);
  },
  function (err) {
    boots.error(err);

    // Update package.
    pack.version = nv;
    fs.writeFileSync(rel + 'package.json', JSON.stringify(pack, null, 2));

    // Remove build dir.
    wrench.rmdirSyncRecursive(rel + dir);

    // Commit the package.json changes.
    util.log(clc.blackBright('Committing package version bump ...'));
    exec('git commit -a -m "' + 'bump v' + nv + '"', this);
  },
  function (err) {
    boots.error(err);

    // Push to eb.
    if (argv.push) {
      util.log(clc.blackBright('Pushing to AWS Elastic Beanstalk ...'));
      exec('eb push', this);
    } else this();
  },
  function (err) {
    boots.error(err);

    // Done.
    util.log(clc.green('Build complete!'));
    process.exit(0);
  }
);
