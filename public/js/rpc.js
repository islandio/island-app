/*
 * Async execution of RPCs to the server.
 */

define([
  'jQuery',
  'Underscore',
  'mps'
], function ($, _, mps) {
  return {  

    exec: function(type, url, data, cb) {
      if (!data || typeof data === 'function') {
        cb = data;
        data = {};
      }
      cb = cb || function(){};

      // Execute the RPC for reals:
      return $.ajax({
        url: url,
        type: type,
        data: JSON.stringify(data),
        success: _.bind(cb, cb, undefined),
        error: function (res) {
          cb(JSON.parse(res.responseText).error);
        },
        contentType: 'application/json', 
        dataType: 'json'
      });

    },

    get: function (url, data, cb) {
      this.exec('GET', url, data, cb);
    },

    post: function (url, data, cb) {
      this.exec('POST', url, data, cb);
    }

  }
});