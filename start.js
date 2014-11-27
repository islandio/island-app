#!/usr/bin/env node
/*
 * start.js: Run app.
 *
 */

// Module Dependencies
var fork = require('child_process').fork;

// Runs utils...
fork('util/index.js');

// Start application...
fork('main.js', ['--index']);
