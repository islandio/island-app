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

var PubSub = exports = function (options) {
  this.pusher = new Pusher(options);
}

// PubSub.prototype.notify = function (props, cb) {

//   Step(
//     function () {

//       self.createEvent(props, this.parallel());


//         props.poster_id = props.post.member._id;
//         props.data.o = post.member.displayName;
//         db.createDoc(self.collections.event, props, cb);
      


//       self.collections.subscription.find({
//         post_id: props.post_id,
//         mute: false,
//       }).toArray(this.parallel());

//     },
//     function (err, event, subs) {
//       if (err) return cb ? cb(err) : null;
//       if (subs.length > 0) {
//         var next = _.after(subs.length, this);
//         _.each(subs, function (sub) {
//           if (sub.member_id.toString() === event.member_id.toString())
//             return next();
//           self.createNotification({
//             member_id: sub.member_id,
//             subscription_id: sub._id,
//             event: event,
//           }, function (err, note) {
//             if (err) return next(err);
//             self.pusher.trigger(sub.channel, 'notification', note);
//             self.memberDb.findMemberById(sub.member_id, true, function (err, mem) {
//               if (!err && (mem.config.notifications.comment.email === true
//                   || mem.config.notifications.comment.email === 'true'))
//                 Email.notification(mem, note);
//             });
//             next();
//           });
//         });
//       } else this();
//     },
//     function (err) {
//       if (cb) cb(err);
//     }
//   );
// }

// PubSub.prototype.subscribe = function (props, cb) {
//   var self = this;
//   if (!db.validate(props, ['member_id', 'post_id', 'channel']))
//     return cb ? cb(new Error('Invalid subscription')) : null;
//   _.defaults(props, {
//     mute: false
//   });
//   Step(
//     function () {
//       var next = this;
//       self.collections.subscription.findOne({
//         member_id: props.member_id,
//         post_id: props.post_id,
//       }, function (err, sub) {
//         if (err || sub) return cb ? cb(err, sub) : null;
//         else db.createDoc(self.collections.subscription, props, cb);
//       });
//     }
//   );
// }

// PubSub.prototype.createEvent = function (props, cb) {
//   var self = this;
//   if (!db.validate(props, ['member_id', 'post_id', 'data']))
//     return cb(new Error('Invalid event'));
//   _.defaults(props, {
//     //
//   });
//   self.memberDb.findPostById(props.post_id, function (err, post) {
//     if (err) return cb(err);
//     props.poster_id = new ObjectID(post.member._id);
//     props.data.o = post.member.displayName;
//     db.createDoc(self.collections.event, props, cb);
//   });
// }

// PubSub.prototype.createNotification = function (props, cb) {
//   var self = this;
//   if (!db.validate(props, ['member_id', 'subscription_id', 'event']))
//     return cb(new Error('Invalid notification'));
//   _.defaults(props, {
//     read: false,
//   });
//   db.createDoc(self.collections.notification, props, cb);
// }
