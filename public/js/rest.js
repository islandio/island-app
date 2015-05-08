/*
 * Async REST.
 */

define([
  'jQuery',
  'Underscore',
  'mps'
], function ($, _, mps) {
  return {

    exec: function(type, url, data, cb) {
      if (typeof data === 'function') {
        cb = data;
        data = null;
      }
      cb = cb || function(){};
      var params = {
        url: url,
        type: type,
        success: _.bind(cb, cb, undefined),
        error: function (res) {
          var err;
          try {
            err = JSON.parse(res.responseText);
            var data = err.data;
            err = err.code ? err: {
              member: err.member,
              content: err.content,
              message: err.error.message,
              stack: err.error.stack,
              explain: err.error.explain,
              level: err.error.level,
              code: res.status,
              type: err.error.type,
              transloadit: err.transloadit
            };
            if (data) {
              err.data = data;
            }
          } catch (e) {
            err = res.status + ' - "' + res.statusText + '"';
          }
          if (res.status === 200) {
            return cb(null, res.responseText);
          }
          if (typeof err === 'string') {
            return cb(err);
          }
          var log = new Error();
          _.each(err, function (v, k) {
            if (v && k !== 'member' && k !== 'content' && k !==
                'transloadit' && k !== 'stack') {
              log[k] = v;
            }
          });
          log.stack = err.stack;
          console.log(type + ': ', log);
          cb(err);
        },
        contentType: 'application/json',
        dataType: 'json'
      };
      if (data) {
        if (type === 'POST') {
          params.data = JSON.stringify(data);
        } else {
          params.url += '?' + $.param(data);
        }
      }
      return $.ajax(params);
    },

    get: function (url, data, cb) {
      this.exec('GET', url, data, cb);
    },

    post: function (url, data, cb) {
      this.exec('POST', url, data, cb);
    },

    put: function (url, data, cb) {
      data = data || {};
      if (typeof data === 'function') {
        cb = data;
        data = {};
      }
      data._method = 'PUT';
      this.exec('POST', url, data, cb);
    },

    delete: function (url, data, cb) {
      data = data || {};
      if (typeof data === 'function') {
        cb = data;
        data = {};
      }
      data._method = 'DELETE';
      this.exec('POST', url, data, cb);
    }

  };
});
