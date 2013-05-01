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
    read: function(url, data, cb) {
      if (typeof data === 'function') {
        cb = data;
        data = null;
      }

      var jqxhr = null;

      // Execute the RPC for reals:
      return $.ajax({
        url: url,
        type: 'POST',
        data: data && !_.isEmpty(data) ? JSON.stringify(data): null,
        success: function(res) {
          if (cb)
            cb.success(res);
        },
        error: function(status, err) {
          if (cb)
            cb.error(status, err);
        },
        contentType: 'application/json', 
        dataType: 'json'
      });

    }
  }
});
