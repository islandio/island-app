/*
 * client.js: Socket methods available to app clients.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('@islandio/util');
var Step = require('step');
var _ = require('underscore');
var _s = require('underscore.string');
var collections = require('@islandio/collections');
var profiles = collections.profiles;
var hasAccess = collections.hasAccess;
var app = require('../app');
var lib8a = require('@islandio/lib8a');
var lib27crags = require('@islandio/lib27crags');

var CHANNELS = [
  'member',
  'post',
  'session',
  'tick',
  'crag',
  'ascent',
  'event',
  'hangten',
  'comment',
  'follow',
  'request',
  'accept',
  'watch'
];

// Handle Execution of fetch queues.
function ExecutionQueue(maxInFlight) {
  var inFlight = 0;
  var queue = [];
  function done() {
    --inFlight;
    while (queue.length && inFlight < maxInFlight) {
      var f = queue.shift();
      ++inFlight;
      f(done);
    }
  }
  return function (f) {
    if (inFlight < maxInFlight) {
      ++inFlight;
      f(done);
    } else {
      queue.push(f);
    }
  };
}

// Constructor
var Client = exports.Client = function (webSock, backSock) {
  this.webSock = webSock;
  this.backSock = backSock;
  this.db = app.get('db');
  this.events = app.get('events');
  this.cache = app.get('cache');
  this.emailer = app.get('emailer');
  this.subscriptions = [];
  var member = this.webSock.client.request.user;

  // Join web socket rooms and subscribe to back-socket channels.
  _.each(CHANNELS, _.bind(function (c) {
    this.channelSubscribe(c);
  }, this));

  if (member && member._id) {
    var uid = member._id.toString();
    this.channelSubscribe('mem-' + uid);
  }

  // RPC handling
  this.webSock.on('rpc', _.bind(function () {

    // Parse arguments.
    var args = Array.prototype.slice.call(arguments);
    var handle = args.pop();
    var fnName = args.shift();
    var fn = this[fnName];
    if (!fn) {
      return this.webSock.emit(handle, 'Invalid method call');
    }

    // Setup callback.
    var cb = _.bind(function (err, data) {
      this.webSock.emit(handle, err, data);
    }, this);
    args.push(cb);

    // Finally, call the method.
    fn.apply(this, args);
  }, this));

  // Relay back-end messages to websockets.
  this.backSock.on('message', _.bind(function (data) {
    // The data is a slow Buffer
    data = data.toString();
    // Now it's a string: channel + aspace + topic + aspace + jsonstring
    var channel = _s.strLeft(data, ' ');
    data = data.substr(data.indexOf(' ') + 1);
    var topic = _s.strLeft(data, ' ');
    data = JSON.parse(data.substr(data.indexOf(' ') + 1));

    // Privacy checks.
    //
    // If the event is private, it was sent directly to this socket, so no
    // access check is needed. If it's public, we only care to check top-level
    // feed docs for now - e.g., the front-end will ignore a comment on a dataset
    // that the member is not meant to see (a member w/ e.p.m., not followed)
    // because it doesn't have its parent.
    // TODO: make sure public flag exists on notes and comments so we can
    // avoid this insecurity.
    if ((topic === 'post.new' || topic === 'session.new' ||
        topic === 'tick.new') && data.public !== false) {
      hasAccess(this.db, member, data, _.bind(function (err, allow) {
        if (!err && allow) {
          _emit.call(this);
        }
      }, this));
    } else {
      _emit.call(this);
    }

    function _emit() {
      // Emit to front-end
      this.webSock.emit(topic, data);
    }
  }, this));

  // Mostly serialize fetch operations - doing a bunch in parallel is
  // mysteriously slower than serially, and there's nothing to be gained by
  // making requests delay each other.
  this.sampleDbExecutionQueue = ExecutionQueue(2);
};

/*
 * Subscribe to a channel.
 */
Client.prototype.channelSubscribe = function (channelName) {
  if (_.contains(this.subscriptions, channelName)) {
    return;
  }
  this.subscriptions.push(channelName);
  this.webSock.join(channelName);
  this.backSock.subscribe(channelName);
};

/*
 * Unsubscribe from a channel.
 */
Client.prototype.channelUnsubscribe = function (channelName) {
  this.webSock.leave(channelName);
  this.backSock.unsubscribe(channelName);
  this.subscriptions = _.without(this.subscriptions, channelName);
};

/*
 * Unsubscribe from all channels.
 */
Client.prototype.channelUnsubscribeAll = function () {
  _.each(this.subscriptions, _.bind(function (cn) {
    this.webSock.leave(cn);
    this.backSock.unsubscribe(cn);
  }, this));
  this.subscriptions = [];
};

/*
 * Get a user from 8a or 27crags.
 */
Client.prototype.getUser = function(obj, cb) {
  if (obj.target.indexOf('8a') !== -1) {
    lib8a.searchUser(obj.userId, cb);
  } else if (obj.target.indexOf('27crags') !== -1) {
    lib27crags.searchUser(obj.userId, cb);
  }
};
