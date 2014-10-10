var Step = require('step');
var request = require('request');
var _ = require('underscore');
var crypto = require('crypto');
var com = require('./common');

var verifyToken = 'instagramTag';

/*
 * pass in app
 * if dev is true, we'll setup a ngrok redirect to localhost for instagram
 * testing
 */

exports.init = function (app) {

  var clientId = app.get('INSTAGRAM_CLIENT_ID');
  var clientSecret = app.get('INSTAGRAM_CLIENT_SECRET');
  //var callbackUrl = app.get('HOME_URI') + '/api/instagram';
  var callbackUrl =  'http://2b57215d.ngrok.com' + '/api/instagram';
  var instagramUser = app.get('INSTAGRAM_USER_ID');

  var interestingTags = ['islandio', 'island.io'];

  var form = {
    client_id: clientId,
    client_secret: clientSecret,
    object: 'tag',
    aspect: 'media',
    verify_token: verifyToken,
    callback_url: callbackUrl
  };

  var apiUrl = 'https://api.instagram.com/v1'
  var subEndpoint = apiUrl + '/subscriptions';
  var tagEndpoint = function (tag) {
    return apiUrl + '/tags/' + tag + '/media/recent';
  };

  _.each(interestingTags, function (i) {

    // extend the form with tags we'd like to sub to
    var _form = _.extend({object_id: i}, form);
    request.post(subUrl, { form: _form }, function(err, res, body) {
      console.log('response:', err, body);
    });
  });

  app.get('/api/instagram', function (req, res) {
    if (req.query) {
      if (req.query['hub.challenge']
          && req.query['hub.verify_token'] === verifyToken) {
        res.send(req.query['hub.challenge']);
      }
    }
  });

  app.post('/api/instagram', function (req, res) {
    console.log(req.body);
    console.log(req.headers);
    console.log(
      crypto.createHmac('sha1', clientSecret).update(req.rawBody.toString('utf8')).digest('hex')
    );

    Step(
      function req() {
        var tag = req.body[0].object_id,
        request.get(tagEndpoint(tag), { qs: { client_id: clientId } }, this);
      },
      function (err, res, body) {
        // Collect users, tagged users, caption, media link
      }
      function(err) {
        if (com.error(err, req, res)) return;
      }
    )
  });

}

