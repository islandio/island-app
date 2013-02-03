// Functionality for handling notifications.

/**
* Module dependencies.
*/
var ObjectID = require('mongodb').BSONPure.ObjectID;
var db = require('./db');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');
var Email = require('./email');

/*
 * Create a db wrapper.
 */
var EventDb = exports.EventDb = function (dB, options, cb) {
  var self = this;
  self.dB = dB;
  self.app = options.app;
  self.pusher = options.pusher;
  self.collections = {};

  var collections = {
    subscription: { index: { member_id: 1, post_id: 1, mute: 1 } },
    event: { index: { member_id: 1 } },
    notification: { index: { member_id: 1, read: 1 } },
  };

  Step(
    function () {
      var group = this.group();
      _.each(collections, function (k, name) {
        dB.collection(name, group());
      });
    },
    function (err, cols) {
      if (err) return this(err);
      _.each(cols, function (col) {
        self.collections[col.collectionName] = col;
      });
      if (options.ensureIndexes) {
        var parallel = this.parallel;
        _.each(cols, function (col) {
          var index = collections[col.collectionName].index;
          if (index)
            col.ensureIndex(index, parallel());
        });
      } else this();
    },
    function (err) {
      cb(err, self);
    }
  );
}

EventDb.prototype.publish = function (props, cb) {
  var self = this;
  if (!props)
    return cb ? cb(new Error('Missing event properties')) : null;
  Step(
    function () {
      self.createEvent(props, this.parallel());
      self.collections.subscription.find({
        post_id: props.post_id,
        mute: false,
      }).toArray(this.parallel());
    },
    function (err, event, subs) {
      if (err) return cb ? cb(err) : null;
      if (subs.length > 0) {
        var next = _.after(subs.length, this);
        _.each(subs, function (sub) {
          if (sub.member_id.toString() === event.member_id.toString())
            return next();
          self.createNotification({
            member_id: sub.member_id,
            subscription_id: sub._id,
            event: event,
          }, function (err, note) {
            if (err) return next(err);
            self.pusher.trigger(sub.channel, 'notification', note);
            self.memberDb.findMemberById(sub.member_id, true, function (err, mem) {
              if (!err) Email.notification(mem, note);
            });
            next();
          });
        });
      } else this();
    },
    function (err) {
      if (cb) cb(err);
    }
  );
}

EventDb.prototype.subscribe = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'post_id', 'channel']))
    return cb ? cb(new Error('Invalid subscription')) : null;
  _.defaults(props, {
    mute: false
  });
  Step(
    function () {
      var next = this;
      self.collections.subscription.findOne({
        member_id: props.member_id,
        post_id: props.post_id,
      }, function (err, sub) {
        if (err || sub) return cb ? cb(err, sub) : null;
        else db.createDoc(self.collections.subscription, props, cb);
      });
    }
  );
}

EventDb.prototype.createEvent = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'post_id', 'data']))
    return cb(new Error('Invalid event'));
  _.defaults(props, {
    //
  });
  self.memberDb.findPostById(props.post_id, function (err, post) {
    if (err) return cb(err);
    props.poster_id = new ObjectID(post.member._id);
    props.data.o = post.member.displayName;
    db.createDoc(self.collections.event, props, cb);
  });
}

EventDb.prototype.createNotification = function (props, cb) {
  var self = this;
  if (!db.validate(props, ['member_id', 'subscription_id', 'event']))
    return cb(new Error('Invalid notification'));
  _.defaults(props, {
    read: false,
  });
  db.createDoc(self.collections.notification, props, cb);
}
