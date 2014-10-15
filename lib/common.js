/*
 * common.js: Common methods for resources and the page service.
 *
 */

// Module Dependencies
var crypto = require('crypto');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
exports.init = function (uri) { exports.ROOT_URI = uri; }

/*
 * Error wrap JSON request.
 */
exports.error = function (err, req, res, data, estr) {
  if (typeof data === 'string') {
    estr = data;
    data = null;
  }
  var fn = req.xhr ? res.send: res.render;
  if (err || (!data && estr)) {
    var profile = {
      member: req.user,
      content: {page: null},
      root: exports.ROOT_URI,
    };
    if (err) {
      util.error(err);
      profile.error = {stack: err.stack};
      fn.call(res, 500, exports.client(profile));
    } else {
      profile.error = {message: estr + ' not found'};
      fn.call(res, 404, exports.client(profile));
    }
    return true;
  } else return false;
}

/*
 * Return new obj for client.
 * - replace ObjectsIDs with strings.
 */
exports.client = function (obj) {
  var obj = _.clone(obj);
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  _.each(obj, function (att, n) {
    if (_.isObject(att) && att._id) {
      att.id = att._id.toString();
      delete att._id;
      exports.client(att);
    } else if (_.isObject(att) || _.isArray(att))
      exports.client(att);
  });
  return obj;
}

/*
 * Creates a string identifier.
 * @length Number
 */
exports.key = function (length) {
  length = length || 8;
  var key = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  return key;
}

/*
 * Make salt for a password.
 */
exports.salt = function () {
  return Math.round((new Date().valueOf() * Math.random())) + '';
}

/*
 * Encrypt string.
 */
exports.encrypt = function (str, salt) {
  return crypto.createHmac('sha1', salt).update(str).digest('hex');
}

/*
 * Hash string.
 */
exports.hash = function (str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/*
 * Create a 32-bit identifier.
 */
exports.createId_32 = function () {
  return String(parseInt(Math.random() * 0x7fffffff));
}

/*
 * Remove ''s from an object.
 */
exports.removeEmptyStrings = function (obj) {
  _.each(obj, function (v, k) {
    if (_.isString(v) && v.trim() === '') {
      delete obj[k];
    }
  });
}

/*
 * Convert tag string to array.
 */
exports.tagify = function (str, delim) {
  var splitter = delim ? '[' + delim + ']': '[\W,_]';
  return !str ? []: _.chain(str.split(new RegExp(splitter)))
    .reject(function (t) { return t === ''; })
    .map(function (t) { return t.trim(); }).uniq().value();
},

/*
 * Parse video URL from text.
 */
exports.parseVideoURL = function (url) {
  if (!url) return false;

  // Try Vimeo.
  var m = url.match(/vimeo.com\/(?:channels\/|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/);
  if (m)
    return {link: {
      id: m[3],
      type: 'vimeo'
    }};

  // Try Youtube.
  m = url.match(/(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>]+)/);
  if (m)
    return {link: {
      id: m[5],
      type: 'youtube'
    }};
  else
    return false;
}
