/*
 * pubsub.js: Handling for pub sub.
 *
 */

// Module Dependencies
var Pusher = require('pusher');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var com = require('./common.js');
var profiles = require('./resources').profiles;

// Constuctor (wrap Pusher)
var PubSub = exports.PubSub = function (options) {
  this.pusher = new Pusher(options);
}

// Publish data over a channel with a topic.
PubSub.prototype.publish = function (channel, topic, data) {
  data = _.clone(data);
  this.pusher.trigger(channel, topic, com.client(data));
}

// Subscribe member to an entity.
PubSub.prototype.subscribe = function (subscriber, subscribee, meta, cb) {
  var props = {
    subscriber_id: subscriber._id,
    subscribee_id: subscribee._id,
    meta: meta,
  };

  db.Subscriptions.read(props, function (err, sub) {
    if (err || sub) return cb ? cb(err, sub): null;
    db.Subscriptions.create(_.extend(props, {
      mute: false,
    }), cb);
  });
}

// Create an event and notifications for subscribers.
// TODO: handle 'follow' and 'watch': get subs where subscribee is
// the actor (follow) and where subscribee is the target (watch). 
PubSub.prototype.notify = function (actor, target, meta, action, cb) {
  if (typeof action === 'function') {
    cb = action;
    action = null;
  }
  var self = this;

  Step(
    function () {

      // Create the event
      var props = {
        actor_id: actor._id, 
        target_id: target._id,
        meta: meta,
      };
      if (action) props.action_id = action._id;
      db.Events.create(props, this.parallel());

      // Get 'watch' subscriptions
      db.Subscription.list({subscribee_id: target._id, mute: false},
          {inflate: {subscriber: profiles.member}}, this.parallel());
    },
    function (err, event, subs) {
      if (err) return cb ? cb(err): null;
      if (subs.length === 0) return this();
      var _cb = _.after(subs.length, cb || function(){});

      _.each(subs, function (sub) {
        if (sub.subscriber_id.toString() === event.actor_id.toString())
          return _cb();

        var props = {
          subscriber_id: sub.subscriber_id,
          subscription_id: sub._id,
          event_id: event._id,
          read: false,
        };

        db.Notifications.create(props, function (err, note) {
          if (err) return _cb(err);

          // Publish notification.
          note.event = event;
          delete event._id;
          self.publish('member-' + sub.subscriber.key,
              'notification.new', note);

          // Handle notification delivery types by subscriber config.
          if (sub.subscriber.config.notifications.comment.email === true
              || mem.config.notifications.comment.email === 'true')
            // Email.notification(sub.subscriber, note);

          _cb();

        });
      });
    }

  );
}
