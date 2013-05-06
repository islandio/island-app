/*
 * common.js: Common methods for resources and the page service.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

/*
 * Error wrap JSON request.
 */
exports.error = function (err, req, res, data, estr) {
  if (typeof data === 'string') {
    estr = data;
    data = null;
  }
  var fn = req.xhr ? res.send: res.render;
  if (err)
    return fn(500, {error: 'server error'});
  else if (!data && estr)
    return fn(404, {error: estr + ' not found'});
  else return false;
}

/*
 * Prepare obj for client.
 * - replace ObjectsIDs with strings.
 */
exports.client = function (obj) {
  _.each(obj, function (att, n) {
    if (_.isObject(att) && att._id) {
      att.id = att._id.toString();
      delete att._id;
      client(att);
    } else if (_.isObject(att) || _.isArray(att))
      client(att);
  });
  return obj;
}