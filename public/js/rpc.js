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
        data = null;
      }
      cb = cb || function(){};

      var params = {
        url: url,
        type: type,
        success: _.bind(cb, cb, undefined),
        error: function (res) {
          cb(JSON.parse(res.responseText).error);
        },
        contentType: 'application/json', 
        dataType: 'json'
      };
      if (data) params.data = JSON.stringify(data);

      return $.ajax(params);
    },

    get: function (url, data, cb) {
      this.exec('GET', url, data, cb);
    },

    post: function (url, data, cb) {
      this.exec('POST', url, data, cb);
    },

    put: function (url, data, cb) {
      this.exec('PUT', url, data, cb);
    },

    delete: function (url, data, cb) {
      this.exec('DELETE', url, data, cb);
    }

  }
});
