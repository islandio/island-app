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
  this.mailer = params.mailer;
}

// Set socketio.
PubSub.prototype.setSocketIO = function (sio) {
  this.sio = sio;
}

// Publish data over a channel with a topic.
PubSub.prototype.publish = function (channel, topic, data) {
  if (!this.sio) return;
  if (!data) data = {};
  else data = _.clone(data);
  this.sio.sockets.in(channel).emit(topic, com.client(data));
}

// Subscribe user to an entity.
PubSub.prototype.subscribe = function (subscriber, subscribee, meta, cb) {
  if (!cb) cb = function(){};
  var props = {
    subscriber_id: subscriber._id,
    subscribee_id: subscribee._id,
    meta: meta,
  };

  db.Subscriptions.create(_.extend(props, {mute: false}), function (err, sub) {
    if (err && err.code !== 11000) return cb(err);
    cb(err, sub);
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

// Create an event and notifications for subscribers.
// TODO: handle 'follow' and 'watch': get subs where subscribee is
// the actor (follow) and where subscribee is the target (watch). 
PubSub.prototype.notify = function (props, body, cb) {
  var self = this;

  if (typeof body === 'function') {
    cb = body;
    body = null;
  }

  Step(
    function () {

      // Create the event.
      db.Events.create(props, props.target_id ? this.parallel(): this);

      // Get 'watch' subscriptions
      if (props.target_id)
        db.Subscriptions.list({
          subscribee_id: props.target_id,
          subscriber_id: {$ne: props.actor_id},
          'meta.style': 'watch',
          mute: false
        }, {inflate: {subscriber: _.extend(_.clone(profiles.member),
            {primaryEmail: 1, config: 1})}}, this.parallel());
    },
    function (err, event, subs) {
      if (err) return cb ? cb(err): null;

      // Publish event.
      self.publish('events', 'event.new', event);

      if (!subs || subs.length === 0) return this();
      var _cb = _.after(subs.length, cb || function(){});

      // Create a notification for each subscriber.
      _.each(subs, function (sub) {
        var props = {
          subscriber_id: sub.subscriber._id,
          subscription_id: sub._id,
          event_id: event._id,
          read: false,
        };

        // Create the notification.
        db.Notifications.create(props, function (err, note) {
          if (err) return _cb(err);

          // Publish notification.
          note.event = event;
          self.publish('mem-' + sub.subscriber._id.toString(),
              'notification.new', note);

          // Handle notification delivery types by subscriber config.
          var email = sub.subscriber.config.notifications.comment.email;
          if ((email === true || email === 'true')
              && sub.subscriber.primaryEmail !== undefined
              && sub.subscriber.primaryEmail !== '')
            self.mailer.notify(sub.subscriber, note, body);

          _cb();
        });
      });
    }

  );
}
