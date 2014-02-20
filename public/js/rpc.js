/*
 * RPC Handling based on Socket.IO.
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'util'
], function ($, _, mps, util) {
  return {

    init: function () {

      // Attach a socket connection.
      this.socket = io.connect(window.location.origin);

      return this;
    },

    do: function () {

      // Check arguments.
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 0)
        return console.error('Missing method name');
      if (args.length < 2 || typeof _.last(args) !== 'function')
        return console.error('Missing callback');

      // Parse arguments.
      var cb = args.pop();
      var handle = ['cb', util.rid32()].join(':');
      args.push(handle);
      args.unshift('rpc');

      // Listen for the callback.
      // TODO: set timeout for destroying subscription
      // if this not fired?
      this.socket.on(handle, _.bind(function () {
        this.socket.removeListener(handle, arguments.callee);
        cb.apply(this, arguments);
      }, this));

      // Finally, emit the event.
      this.socket.emit.apply(this.socket, args);
    }

  }
});
