/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var request = require('request');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;

/* e.g.,
{
  "_id" : <ObjectId>,
  "key": <String>,
  "type": <String>,
  "image": <Object>,
  "thumbs": [<Object>],
  "location": {
    "latitude": <Number>,
    "longitude": <Number>
  },
  "author_id": <ObjectId>,
  "parent_id": <ObjectId>,
  "created": <ISODate>,
  "updated": <ISODate>
}
*/

// Do any initializations
exports.init = function (app) {
  return exports;
}

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');
  var search = app.get('reds').createSearch('medias');

  // List
  app.post('/api/medias/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 3;
    var query = req.body.query || {};

    if (query.author_id) query.author_id = db.oid(query.author_id);
    if (query.parent_id) query.parent_id = db.oid(query.parent_id);

    db.Medias.list(query, {sort: {created: -1}, limit: limit, inc: true,
        skip: limit * cursor, inflate: {author: profiles.member}},
        function (err, medias) {
      if (com.error(err, req, res)) return;

      Step(
        function () {

          // Fill medias.
          db.fill(medias, 'Comments', 'parent_id', {sort: {created: -1},
              limit: 5, reverse: true, inflate: {author: profiles.member}},
              this.parallel());
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({
            medias: {
              cursor: ++cursor,
              more: medias && medias.length === limit,
              items: medias,
              query: query,
            }
          }));
        }
      );
    });

  });

  // Create
  app.post('/api/medias/:type', function (req, res) {
    if (!req.body.video.link || !req.body.parent_id)
      return res.send(403, {error: 'Media invalid'});

    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    var type = req.params.type;
    var resource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;

    // Get the medias's parent.
    db[resource].read({_id: db.oid(props.parent_id)}, function (err, parent) {
      if (com.error(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // Get thumnail and poster.
          // TODO: Handle photos.
          props.type = 'video';
          if (props.video.link.type === 'vimeo') {
            request.get({
              uri: 'https://vimeo.com/api/v2/video/' + props.video.link.id + '.json',
              json: true
            }, _.bind(function (err, res, body) {
              if (err) return this(err);
              if (body.error) return this(body.error);
              props.poster = {
                url: body[0].thumbnail_large,
                meta: {width: 640, height: 360}
              };
              props.thumbs = [{
                url: body[0].thumbnail_small,
                meta: {width: 100, height: 75}
              }];
              this();
            }, this));
          } else if (props.video.link.type === 'youtube') {
            props.poster = {
                url: 'https://img.youtube.com/vi/' + props.video.link.id + '/0.jpg',
                meta: {width: 480, height: 360}
              };
              props.thumbs = [{
                url: 'https://img.youtube.com/vi/' + props.video.link.id + '/2.jpg',
                meta: {width: 120, height: 90}
              }];
            this();
          } else this();
        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Create the media.
          props.parent_id = parent._id;
          db.Medias.create(props, {inflate: {author: profiles.member}},
              function (err, media) {
            if (com.error(err, req, res)) return;

            // This is new so no need to fill comments.
            media.comments = [];

            Step(
              function () {
                if (!media.thumbs || media.thumbs.length === 0
                    || !parent.location) return this();

                // Map images to CartoDB.
                var names = ["the_geom", "mid", "pkey", "turi"];
                var query = "INSERT INTO " + app.get('cartodb').tables.medias + " ("
                    + _.join(",", names) + ") VALUES ";
                query += "(" + _.join(",", [
                    "CDB_LatLng(" + parent.location.latitude + ","
                    + parent.location.longitude + ")",
                    "'" + media._id.toString() + "'",
                    "'" + ('crags/' + parent.key) + "'",
                    "'" + media.thumbs[0].url + "'"]) + ")";

                // Call up the CartoDB API.
                curl.request({
                  url: 'https://' + app.get('cartodb').user
                      + '.cartodb.com/api/v2/sql',
                  method: 'POST',
                  data: {q: query, api_key: app.get('cartodb').api_key}
                }, _.bind(function (err, data) {
                  if (data) {
                    data = JSON.parse(data);
                    if (com.error(data.error, req, res)) return;
                    this();
                  } else this(err);
                }, this));
              },
              function (err) {
                if (com.error(err, req, res)) return;

                // Publish media.
                pubsub.publish('media', 'media.new', {
                  data: media,
                  event: {
                    actor_id: req.user._id,
                    target_id: parent._id,
                    action_id: media._id,
                    action_type: 'media',
                    data: {
                      action: {
                        i: req.user._id.toString(),
                        a: req.user.displayName,
                        g: req.user.gravatar,
                        t: 'media',
                        b: media.type
                      },
                      target: {
                        t: type,
                        n: parent.name,
                        w: parent.crag,
                        s: ['crags', parent.key].join('/')
                      }
                    }
                  },
                  notify: true,
                });

                // Subscribe actor to future events.
                pubsub.subscribe(req.user, parent, {style: 'watch', type: type});
                pubsub.subscribe(req.user, media, {style: 'watch', type: 'media'});

                res.send(com.client({media: media}));
                util.log('Mapped ascent media');
              }
            );
          });
        }
      );
    });

  });

  // Read
  app.get('/api/medias/:id', function (req, res) {

    // Get the media.
    db.Medias.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'media')) return;
      res.send(doc);
    });

  });

  // Delete
  app.delete('/api/medias/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'Member invalid'});

    // Get the media.
    db.Medias.read({_id: db.oid(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'media')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'Member invalid'});

      Step(
        function () {

          // Remove notifications for events where media is target or action.
          db.Events.list({$or: [{target_id: doc._id}, {action_id: doc._id}]},
              _.bind(function (err, events) {
            if (err) return this(err);
            if (events.length === 0) return this();
            var _this = _.after(events.length, this);
            _.each(events, function (e) {

              // Publish removed status.
              pubsub.publish('event', 'event.removed', {data: e});
              
              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  pubsub.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {data: {id: note._id.toString()}});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        },
        function (err) {
          if (err) return this(err);

          // Remove content on post.
          db.Comments.remove({parent_id: doc._id}, this.parallel());
          db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
          db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
              this.parallel());

          // Finally, remove the media.
          db.Medias.remove({_id: doc._id}, this.parallel());

          // De-inc author post count.
          // db.Members._update({_id: doc.author_id}, {$inc: {pcnt: -1}}, this.parallel());

        },
        function (err) {
          if (com.error(err, req, res)) return;

          // Publish removed status.
          pubsub.publish('media', 'media.removed', {data: {id: doc._id.toString()}});

          res.send({removed: true});
        }
      );
    
    });

  });

  // Search
  app.post('/api/medias/search/:s', function (req, res) {

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {

      Step(
        function () {

          // Check results.
          if (ids.length === 0) return this();

          // Map to actual object ids.
          var _ids = _.map(ids, function (id) {
            return db.oid(id);
          });

          // Get the matching posts.
          db.Medias.list({_id: {$in: _ids}}, {sort: {created: 1}, limit: 50,
              inflate: {author: profiles.member}}, this);

        },
        function (err, posts) {
          if (com.error(err, req, res)) return;

          // Send profile.
          res.send(com.client({items: posts || []}));

        }
      );
      
    }, 'or');

  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}
