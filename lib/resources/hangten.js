/*
 * hangten.js: Handling for the hangten resource.
 *
 */

// Module Dependencies
var util = require('util');
var iutil = require('island-util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var profiles = require('island-collections').profiles;
var app = require('../../app');

/* e.g.,
  {
    "_id": <ObjectId>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

// Do any initializations
exports.init = function () {
  return this.routes();
}

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // Create
  app.post('/api/hangtens/:type', function (req, res) {
    if (!req.body.parent_id) {
      return res.send(403, {error: 'Hangten invalid'});
    }
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = {author_id: req.user._id};
    props.parent_type = type;

    // Parent type could be post, tick, crag, ascent.
    var inflate = {author: profiles.member};
    switch (type) {
      case 'post':
      case 'crag':
      case 'ascent':
        break;
      case 'tick':
        inflate.ascent = profiles.ascent;
        break;
    }

    // Get the hangten's parent.
    db[typeResource].read({_id: db.oid(req.body.parent_id)},
        {inflate: inflate}, function (err, parent) {
      if (errorHandler(err, req, res, parent, 'parent')) return;

      Step(
        function () {

          // Create the hangten.
          props.parent_id = parent._id;
          db.Hangtens.create(props, {inflate: {author: profiles.member}},
              function (err, doc) {
            if (errorHandler(err, req, res)) return;

            // Handle different types.
            var target = {
              t: type,
              i: parent.author._id.toString(),
              a: parent.author.displayName,
              u: parent.author.username
            };
            switch (type) {
              case 'post':
                target.n = parent.title !== '' ?
                    parent.title: _.prune(parent.body, 20);
                target.s = parent.key;
                break;
              case 'tick':
                target.n = parent.ascent.name;
                target.l = parent.ascent.crag;
                target.s = [parent.author.username, 'ticks', parent.key].join('/');
                break;
              case 'crag':
                target.n = parent.name;
                target.l = parent.country;
                target.s = ['crags', parent.key].join('/');
                break;
              case 'ascent':
                target.n = parent.name;
                target.l = parent.crag;
                target.s = ['crags', parent.key].join('/');
                target.pt = parent.type;
                break;
            }
            target.s += '#h=' + doc._id.toString();

            // Notify only if public.
            var notify = {};
            if (parent.public !== false) {
              notify = {subscriber: true};
            }

            // Publish hangten.
            events.publish('hangten', 'hangten.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: parent._id,
                target_author_id: parent.author._id,
                action_id: doc._id,
                action_type: 'hangten',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'hangten',
                    b: _.prune(doc.body, 40)
                  },
                  target: target
                }
              },
              options: {method: 'DEMAND_WATCH_SUBSCRIPTION_FROM_AUTHOR'},
              notify: notify
            });

            // Finish.
            res.send({id: doc._id.toString()});
          });
        }
      );
    });
  });

  // Delete
  app.delete('/api/hangtens/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    // Get the hangten.
    db.Hangtens.read({_id: db.oid(req.params.id),
        author_id: req.user._id}, function (err, doc) {
      if (errorHandler(err, req, res, doc, 'hangten')) return;

      Step(
        function () {

          // Remove notifications for events where hangten is action.
          db.Events.list({action_id: doc._id}, _.bind(function (err, es) {
            if (es.length === 0) {
              return this();
            }
            var _this = _.after(es.length, this);
            _.each(es, function (e) {

              // Publish removed status.
              events.publish('event', 'event.removed', {data: e});

              db.Notifications.list({event_id: e._id}, function (err, notes) {

                // Publish removed statuses.
                _.each(notes, function (note) {
                  events.publish('mem-' + note.subscriber_id.toString(),
                      'notification.removed', {data: {id: note._id.toString()}});
                });
              });
              db.Notifications.remove({event_id: e._id}, _this);
            });
          }, this));
        }, function (err) {
          if (err) return this(err);

          // Remove events where hangten is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the hangten.
          db.Hangtens.remove({_id: db.oid(req.params.id)}, this.parallel());
        },
        function (err) {
          if (errorHandler(err, req, res)) return;

          // Publish removed status.
          events.publish('hangten', 'hangten.removed', {data: {id: req.params.id}});

          res.send({removed: true});
        }
      );
    });
  });

  return exports;
}
