#!/usr/bin/env node

var request = require('request');
var log = require('console').log;
var util = require('util'), error = util.error,
    debug = util.debug, inspect = util.inspect;
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var clc = require('cli-color');
var optimist = require('optimist');
var argv = optimist
    .demand('opp')
    .demand('type')
    .demand('gradient')
    .argv;

// Errors wrapper.
function errCheck(err, op) {
  if (err) {
    error('Error: ' + (op || '') + ':\n' + err.stack);
    process.exit(1);
  };
}

// Make density range css.
function range(r, t, m) {
   r = r.reverse();
   var css = '';
   _.each(r, function (g) {
      css += '#crags [' + t + 'grd <= ' + g + '] {ba/marker-width: ' + (m * g + 10) + ';}\n';
   });
   return css;
}

// Handle opperation.
switch (argv.opp) {
   case 'range':
   log(range(_.range(0,30), argv.type, argv.gradient))
}
