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
  var callbackUrl =  'http://649c5a35.ngrok.com/api/instagram';
  var instagramUser = app.get('INSTAGRAM_USER_ID');

  var interestingTags = ['islandio'];

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
    request.post(subEndpoint, { form: _form }, function(err, res, body) {
      console.log('response:', err, body);
    });
  });

  app.get('/api/instagram', function (req, res) {
    console.log(req.query);
    if (req.query) {
      if (req.query['hub.challenge']
          && req.query['hub.verify_token'] === verifyToken) {
        res.send(req.query['hub.challenge']);
        return;
      }
    }
    res.send();
  });

  app.post('/api/instagram', function (req, res) {
    console.log(req.body);
    console.log(req.headers);
    /*
    console.log(
      crypto.createHmac('sha1', clientSecret).update(req.rawBody.toString('utf8')).digest('hex')
    );
    */

    if (!req.body || req.body.length === 0) {
      com.error('Empty', req, res);
      return;
    }

    // Get earliest timestamp from new subscription notice.
    var earliestTimestamp = _.min(_.pluck(req.body, 'time'));
    console.log('earliest ts', earliestTimestamp);

    var recentData = null;

    Step(

      // Lookup this hashtag from instagram
      function getTagsRequest() {
        var tag = req.body[0].object_id;
        console.log(tagEndpoint(tag));
        request.get(tagEndpoint(tag), { qs: { client_id: clientId } }, this);
      },

      function (err, res, body) {
        if (err) return this(err);
        var body = JSON.parse(body);

        // Get all recent data for this hashtag by filtering on the subscription's
        // timestamp
        recentData = _.filter(body.data, function(d) {
          console.log(d.created_time, earliestTimestamp);
          return d.created_time >= earliestTimestamp;
        });

        var group = this.group();

        // Get the users associated with this instagram tag.  If users
        // haven't linked their accounts, we'll go userless
        _.each(recentData, function (r) {
          db.Members.read({instagramId: r.user.id}, group());
        }
      },

      // Create s post
      function (err, memberDocs) {
        if (err) return this(err);
        console.log(member);

        // For each new post, create a new Post resource  item
        var key = com.createId_32();

        _.each(recentData, function (r, idx) {
          var props = {
            body: r.caption.text,
            title: '',
            type: 'image', // TODO: or video
            product: {
              sku: null,
              price: null,
              type: null,
              subtype: null,
            },
            key: [memberDocs[idx], key].join('/'),
            author_id: req.user._id
          };

        db.Posts.create(props, {inflate: {author: profiles.member},
            force: {key: 1}}, function (err, doc) {
        }

      }

        var objs = _.map(recentData, function (d) {
          var a = {
            actor_id: 
          }
          var a = {
            author: d.user.username,
            caption: d.caption.text,
            created: d.created_time,
            media: d.images.standard_resolution,
            media_thumb: d.images.thumbnail,
            location: d.location,
          }
          return a;
        });

        console.log(objs);
      },
      function(err) {
        if (com.error(err, req, res)) return;
      }
    )
  });

}

