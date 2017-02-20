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
var _s = require('underscore.string');
var app = require('../app');
var events = app.get('events');
var twitter = require('twitter-text');

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

exports.postToFacebook = function (author, path) {
  if (!author.facebookToken) {
    return console.log('Error in postToFacebook: Author invalid');
  }

  var params = {
    link: [baseURL, path].join('/'),
    app_id: keys.facebook.clientID,
    access_token: author.facebookToken
  };

  request.post({
    uri: ['https://graph.facebook.com', author.facebookId,
        'feed'].join('/'),
    qs: params,
    json: true
  }, function (err, res, body) {
    if (err) {
      return console.log('Error in postToFacebook: ' + (err.stack || err));
    }
    if (body.error) {
      body.error.from = 'facebook';
      var error = new ShareError(body.error);
      console.log('ShareError: ' + author.username + ': ' +
          JSON.stringify(error.message));
      var message = error.message.code === 190 ?
          'There was a problem sharing your post to Facebook. ' +
          'Please <a href="/connect/facebook">' +
          're-connect your account</a> and try again.':
          'Facebook error: ' + error.message.message;
      events.publish('mem-' + author._id.toString(), 'flash.new', {
        data: {
          message: message,
          level: 'error',
          sticky: true
        }
      });
    }
  });
};

exports.tweet = function (author, path, txt) {
  if (!author.twitterToken || !author.twitterSecret) {
    return console.log('Error in tweet: Author invalid');
  }

  var link = [baseURL, path].join('/');
  var tweet = [txt, link].join(' ');
  var len = twitter.getTweetLength(tweet);
  if (len > 140) {
    var over = len - 140 + 3;
    tweet = [_s.prune(txt, txt.length - over), link].join(' ');
  }

  var uri = 'https://api.twitter.com/1.1/statuses/update.json?';
  var params = {status: tweet};
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
    if (err) {
      return console.log('Error in tweet: ' + (err.stack || err));
    }
    if (body.errors) {
      var error = new ShareError({from: 'twitter', msg: body.errors[0].message,
          code: body.errors[0].code});
      console.log('ShareError: ' + author.username + ': ' +
          JSON.stringify(error.message));
      if (error.message.code === 89) {
        events.publish('mem-' + author._id.toString(), 'flash.new', {
          data: {
            message: 'There was a problem sharing your post to Twitter. ' +
                'Please <a href="/connect/twitter">' +
                're-connect your account</a> and try again.',
            level: 'error',
            sticky: true
          }
        });
      }
    }
  });
};
