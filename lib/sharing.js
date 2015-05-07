/*
 * sharing.js: Sharing methods.
 *
 */

// Module Dependencies
var request = require('request');
var qs = require('querystring');
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var app = require('../app');

var baseURL = process.env.tunnelURL || app.get('HOME_URI');
var keys = {
  facebook: {
    name: app.get('FACEBOOK_NAME'),
    clientID: app.get('FACEBOOK_CLIENT_ID'),
    clientSecret: app.get('FACEBOOK_CLIENT_SECRET')
  },
  twitter: {
    consumerKey: app.get('TWITTER_CONSUMER_KEY'),
    consumerSecret: app.get('TWITTER_CONSUMER_SECRET')
  }
};

var ShareError = exports.ShareError = function (msg, constr) {
  Error.captureStackTrace(this, constr || this);
  this.message = msg || 'Error';
};
util.inherits(ShareError, Error);
ShareError.prototype.name = 'Share Error';

exports.postToFacebook = function (author, path, cb) {
  var params = {
    link: (process.env.tunnelURL || app.get('HOME_URI')) + '/' + path,
    app_id: keys.facebook.clientID,
    access_token: author.facebookToken
  };

  request.post({
    uri: ['https://graph.facebook.com', author.facebookId,
        'feed'].join('/'),
    qs: params,
    json: true
  }, function (err, res, body) {
    if (err) return cb(err);
    if (body.error) {
      var e = body.error;
      e.from = 'facebook';
      return cb(new ShareError(e));
    }
    cb();
  });
};

exports.tweet = function (author, path, txt, cb) {
  var link = [baseURL, path].join('/');
  var placeholder = '_%t_';
  var status = placeholder + ' ' + link;
  txt = _.prune(txt, 140 - status.length + placeholder.length);
  status = status.replace('_%t_', txt);

  var uri = 'https://api.twitter.com/1.1/statuses/update.json?';
  var params = {status: status};
  uri += qs.stringify(params);
  uri = uri
      .replace(/\!/g, "%21")
      .replace(/\'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");

  request.post({
    uri: uri,
    oauth: {
      consumer_key: keys.twitter.consumerKey,
      consumer_secret: keys.twitter.consumerSecret,
      token: author.twitterToken,
      token_secret: author.twitterSecret
    },
    json: true
  }, function (err, req, body) {
    if (err) return cb(err);
    if (body.errors) {
      var e = {from: 'twitter', msg: body.errors[0].message,
          code: body.errors[0].code};
      return cb(new ShareError(e));
    }
    cb();
  });
};
