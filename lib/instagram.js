/* Instagram subscription.  It will automatically post to Island on
 * subscribed tags.
 *
 */

var Step = require('step');
var request = require('request');
var _ = require('underscore');
var crypto = require('crypto');
var com = require('./common');
var db = require('./db');

exports.init = function (app) {

  // Used by instagram for back and forth comms
  var verifyToken = 'instagramTag';

  var clientId = app.get('INSTAGRAM_CLIENT_ID');
  var clientSecret = app.get('INSTAGRAM_CLIENT_SECRET');

  // Set instagram to hit our tunnel to localhost in 'dev', or our home URL
  // in production
  var callbackUrl = (app.get('TUNNEL_URI')
      ? app.get('TUNNEL_URI') : app.get('HOME_URI')) + '/api/instagram';

  var instagramUser = app.get('INSTAGRAM_USER_ID');
  var pubsub = app.get('pubsub');

  var interestingTags = ['islandio'];

  var form = {
    client_id: clientId,
    client_secret: clientSecret,
    object: 'tag',
    aspect: 'media',
    verify_token: verifyToken,
    callback_url: callbackUrl
  };

  var apiUrl = 'https://api.instagram.com/v1';
  var subEndpoint = apiUrl + '/subscriptions';
  var tagEndpoint = function (tag) {
    return apiUrl + '/tags/' + tag + '/media/recent';
  };

  /*  TODO: We need to do this manually or by script
  _.each(interestingTags, function (i) {

    // extend the form with tags we'd like to sub to
    var _form = _.extend({object_id: i}, form);

    // Add delay to allow Amazon servers to settle
    _.delay(function() {
      request.post(subEndpoint, { form: _form }, function(err, res, body) {
        if (!err && res.statusCode === 200) {
          console.log('Subscribed to instagram tags');
        }
      });
    }, 2000);
  });
  */

  // Instagram hits this to verify the subscription request.
  app.get('/api/instagram', function (req, res) {
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

    var signature = crypto.createHmac('sha1', clientSecret)
        .update(req.rawBody).digest('hex');
    if (signature !== req.headers['x-hub-signature']) {
      com.error('Signature wrong on /api/instagram post', req, res);
      return;
    }

    if (!req.body || req.body.length === 0) {
      com.error('Empty', req, res);
      return;
    }

    // Get earliest timestamp from new subscription notice.
    var earliestTimestamp = _.min(_.pluck(req.body, 'time'));

    // cached database reads
    var recentData = null;
    var members = null;
    var posts = null;
    var defaultUser = null;

    Step(

      function getDefaultUser() {
        db.Members.read({username: 'instagram'}, this);
      },

      // Lookup this hashtag from instagram
      function getTagsRequest(err, doc) {
        if (err) return this(err);
        if (!doc) return this('No default user found for instagram posts');

        defaultUser = doc;

        var tag = req.body[0].object_id;
        request.get(tagEndpoint(tag), { qs: { client_id: clientId } }, this);
      },

      function (err, res, body) {
        if (err) return this(err);
        body = JSON.parse(body);

        // Get all recent data for this hashtag by filtering on the subscription's
        // timestamp
        recentData = _.filter(body.data, function(d) {
          return d.created_time >= earliestTimestamp;
        }).reverse();

        var group = this.group();

        // Get the users associated with this instagram tag.  If users
        // haven't linked their accounts, we'll go userless
        _.each(recentData, function (r) {
          db.Members.read({instagramId: r.user.username}, group());
        });
      },

      // Create a post
      function (err, memberDocs) {
        if (err) return this(err);

        members = memberDocs;

        var group = this.group();
        _.each(recentData, function (r, idx) {

          // For each new post, create a new Post resource  item
          var key = com.createId_32();

          // use the default user
          var member = memberDocs[idx] ? memberDocs[idx] : defaultUser;

          var body = '';
          //if (member === defaultUser)
            body += '@' + r.caption.from.username + ': ';
          body += r.caption.text;
          body += '(' + r.link + ')'


          var props = {
            body: body,
            title: '',
            type: 'image', // TODO: or video
            product: {
              sku: null,
              price: null,
              type: null,
              subtype: null,
            },
            key: [member.username, key].join('/'),
            author_id: member._id
          };

          db.Posts.create(props, {force: {key: 1}}, group());
        });
      },

      function (err, postDocs) {
        if (err) return this(err);
        // Event props.

        posts = postDocs;

        var group = this.group();

        _.each(recentData, function(r, idx) {

          var member = members[idx] ? members[idx] : defaultUser;

          var event = {
            actor_id: member._id,
            target_id: null, // TODO: This will be a crag or ascent
            action_id: postDocs[idx]._id,
            action_type: 'post',
            data: {
              action: {
                i: member._id.toString(),
                a: member.displayName,
                g: member.gravatar,
                t: 'post',
                b: _.prune(r.caption.text, 140),
                n: '',
                s: postDocs[idx].key
              }
            }
          };

          // Publish post.
          pubsub.publish('post', 'post.new',
              {data: postDocs[idx], event: event});

          // Subscribe actor to future events.
          pubsub.subscribe(member, postDocs[idx],
              {style: 'watch', type: 'post'});
        });
      },

      // Create media which points to the instagram URL
      function(err, eventDocs) {
        if (err) return this(err);

        var group = this.group();

        _.each(recentData, function(r, idx) {

          var member = members[idx] ? members[idx] : defaultUser;

          var stdResName = _.last(r.images.standard_resolution.url.split('/'));
          var thumbName = _.last(r.images.thumbnail.url.split('/'));

          var props = {
            type: 'image',
            parent_id: posts[idx]._id,
            author_id: member._id,
            image: {
              id: r.id,
              name: stdResName,
              basename: stdResName.split('.')[0],
              ext: stdResName.split('.')[1],
              url: r.images.standard_resolution.url,
              meta: {
                width: r.images.standard_resolution.width,
                height: r.images.standard_resolution.height
              }
            },
            thumbs: [ {
              id: r.id,
              name: thumbName,
              basename: thumbName.split('.')[0],
              ext: thumbName.split('.')[1],
              url: r.images.thumbnail.url,
              meta: {
                width: r.images.thumbnail.width,
                height: r.images.thumbnail.height
              }
            } ]
          };

          db.Medias.create(props, group());
        });
      },

      // Cleanup
      function(err) {
        if (com.error(err, req, res)) return;
        else res.send();
      }
    );
  });

};

