/*
 * Async execution of RPCs to the server.
 */

define([
  'jQuery',
  'Underscore',
  'mps'
], function ($, _, mps) {
  return {  

    /**
     * Executes an RPC asynchronously.
     * 
     * Args:
     *   url: The URL endpoint for the RPC
     *   data: Object with RPC parameters.
     *   cb: Object with a success and error function.
     */
    exec: function(url, data, cb) {
      if (!data || typeof data === 'function') {
        cb = data;
        data = {};
      }
      cb = cb || function(){};

      // Execute the RPC for reals:
      return $.ajax({
        url: url,
        type: 'POST',
        data: JSON.stringify(data),
        success: _.bind(cb, cb, undefined),
        error: function (res) {
          cb(JSON.parse(res.responseText).error);
        },
        contentType: 'application/json', 
        dataType: 'json'
      });

    }
  }
});