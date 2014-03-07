/*
 * pubsub.js: Handling for pub sub.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common');
var profiles = require('./resources').profiles;

// Constuctor
var PubSub = exports.PubSub = function (params) {
  this.mailer = (params || {}).mailer;
}

// Set socketio.
PubSub.prototype.setSocketIO = function (sio) {
  this.sio = sio;
}

// Subscribe user to an entity.
PubSub.prototype.subscribe = function (subscriber, subscribee, meta, cb) {
  if (!cb) cb = function(){};
  var props = {
    subscriber_id: subscriber._id,
    subscribee_id: subscribee._id,
    meta: meta,
    mute: false
  };
  db.Subscriptions.create(props, function (err, sub) {
    if (err && err.code !== 11000) return cb(err);
    cb(null, sub);
  });
}

// Unsubscribe user to an entity.
PubSub.prototype.unsubscribe = function (subscriber, subscribee, cb) {
  if (!cb) cb = function(){};
  var props = {
    subscriber_id: subscriber._id,
    subscribee_id: subscribee._id
  };
  db.Subscriptions.remove(props, cb);
}

// Publish data over a channel with a topic.
// Optionally create an event.
// Optionally create a notification.
PubSub.prototype.publish = function (channel, topic, params, cb) {
  if (typeof params === 'function') {
    cb = params;
    params = {};
  }
  params = params || {};
  cb = cb || function(){};
  if (!channel || !topic || !params.data)
    return cb('Invalid data');
  var self = this;

  // Publish raw data (for static lists, tickers).
  if (self.sio)
    self.sio.sockets.in(channel).emit(topic, com.client(params.data));

  // Create the event.
  if (!params.event) return cb();
  params.event.date = params.data.date || params.data.created;
  db.Events.create(params.event, function (err, event) {
    if (err) return cb(err);

    Step(
      function () {

        // Get 'follow' subscriptions.
        var query = {
          subscribee_id: event.actor_id,
          'meta.style': 'follow',
          mute: false
        };

        // Get 'watch' subscriptions (if there's something to watch).
        if (event.target_id)
          query = {$or: [query, {
            subscribee_id: event.target_id,
            'meta.style': 'watch',
            mute: false
          }]};

        db.Subscriptions.list(query, {
          inflate: {
            subscriber: _.extend(_.clone(profiles.member), {
              primaryEmail: 1,
              config: 1
            })
          }
        }, this);
      },
      function (err, subs) {
        if (err) return cb(err);

        // Attach data to event.
        var data = com.client(_.extend(_.clone(event),
            {action: _.clone(params.data)}));
        
        // Publish event to creator.
        if (self.sio)
          self.sio.sockets.in('mem-' + event.actor_id.toString())
              .emit('event.new', data);
        
        // Publish event to subscribers.
        if (self.sio)
          _.each(subs, function (sub) {
            self.sio.sockets.in('mem-' + sub.subscriber._id.toString())
                .emit('event.new', data);
          });

        // If notify, create a notification for each subscriber.
        if (!params.notify || subs.length === 0) return cb();
        var _cb = _.after(subs.length, cb);
        _.each(subs, function (sub) {
          if (sub.subscriber._id.toString() === event.actor_id.toString())
            return;

          // Create the notification.
          db.Notifications.create({
            subscriber_id: sub.subscriber._id,
            subscription_id: sub._id,
            event_id: event._id,
            read: false
          }, function (err, note) {
            if (err) return _cb(err);

            // Publish notification.
            note.event = event;
            if (self.sio)
              self.sio.sockets.in('mem-' + sub.subscriber._id.toString())
                  .emit('notification.new', com.client(note));

            // Handle notification delivery types by subscriber config.
            var notifications = sub.subscriber.config.notifications;
            var email = notifications[channel] && notifications[channel].email;
            if (self.mailer && (email === true || email === 'true')
                && sub.subscriber.primaryEmail !== undefined
                && sub.subscriber.primaryEmail !== '') {
              self.mailer.notify(sub.subscriber, note, params.data.body);
            }

            _cb();
          });
        });
      }

    );

  });
}
