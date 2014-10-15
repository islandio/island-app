/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var color = require('cli-color');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;

// Constructor
var Client = exports.Client = function (socket, pubsub) {
  this.socket = socket;
  this.pubsub = pubsub;

  // RPC handling
  this.socket.on('rpc', _.bind(function () {

    // Parse arguments.
    var args = Array.prototype.slice.call(arguments);
    var handle = args.pop();
    var fn = this[args.shift()];
    if (!fn) return this.socket.emit(handle, 'Invalid method call');

    // Setup callback.
    var cb = _.bind(function (err, data) {
      this.socket.emit(handle, err, data);
    }, this);
    args.push(cb);

    // Finally, call the method.
    fn.apply(this, args);
  }, this));
}

/*
 * Fetch events.
 */
Client.prototype.fetchEvents = function (event, options, cb) {}
