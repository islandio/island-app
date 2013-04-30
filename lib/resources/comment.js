/*
 * comment.js: Handling for the comment resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Members = require('../db.js').Members;
var Comments = require('../db.js').Comments;
var authorize = require('./member.js').authorize;

/* e.g.,
  {
    "_id": <ObjectId>,
    "member_id": <ObjectId>,
    "body": <String>,
    "post_id": <ObjectId>,
    "likes": <Number>,
    "created": <ISODate>,
    "updated": <ISODate>
}
*/

// Define routes.
exports.routes = function (app) {

  // Recent comments search
  app.get('/comments/:id/:limit', function (req, res) {
    var query = req.params.id === 'all' ? {} :
        { $or: [ { member_id: new ObjectID(req.params.id) },
                 { post_id: new ObjectID(req.params.id) }]};
    var opts = { sort: { created: -1 } };
    if (req.params.limit && req.params.limit !== '0')
      opts.limit = req.params.limit;
    memberDb.findComments(query, opts, function (err, docs) {
      if (err) return fail(err);
      var showMember = req.query.showMember
                      && req.query.showMember === 'true';
      Step(
        function () {
          var group = this.group();
          _.each(docs, function (doc) {
            if (req.query.showPost !== 'true')
              delete doc.post;
            renderComment({
              comment: doc,
              member: req.user,
              showMember: showMember
            }, group());
          });
        },
        function (err, results) {
          if (err) return fail(err);
          res.send({ status: 'success',
                   data: { results: results } });
        }
      );
    });
    function fail(err) {
      res.send({ status: 'error',
               message: err.stack });
    }
  });

  // Add comment
  app.put('/comment/:postId', function (req, res) {
    if (!req.params.postId || !req.body.body)
      fail(new Error('Failed to insert comment'));
    if (!req.user)
      return res.send({
        status: 'fail',
        data: {
          code: 'NOT_A_MEMBER',
          message: 'Please login first.'
        }
      });
    var props = {
      post_id: req.params.postId,
      member_id: req.user._id,
      body: req.body.body,
    };
    memberDb.createComment(props, function (err, doc) {
      if (err) return fail(err);
      distributeComment(doc, req.user);
      distributeUpdate('comment', 'post', 'ccnt', doc.post._id);
      eventDb.subscribe({
        member_id: req.user._id,
        post_id: new ObjectID(req.params.postId),
        channel: channels.all + '-' + req.user.key,
      });
      eventDb.publish({
        member_id: req.user._id,
        post_id: new ObjectID(req.params.postId),
        data: {
          m: req.user.displayName,
          a: 'commented on',
          p: doc.post.title,
          k: doc.post.key,
          b: doc.body
        }
      });
      res.send({ status: 'success', data: {
               comment: doc } });
    });
    function fail(err) {
      if ('NOT_CONFIRMED' === err.code)
        res.send({
          status: 'fail',
          data: {
            code: err.code,
            message: err.member.name.givenName + ', please confirm your account by '
                    + 'following the link in your confirmation email. '
                    + '<a href="javascript:;" id="noconf-'
                    + err.member._id.toString() + '" class="resend-conf">'
                    + 'Re-send the confirmation email</a> if you need to.'
          }
        });
      else
        res.send({ status: 'error',
                message: err.stack });
    }
  });

  app.delete('/comment/:id', authorize, function (req, res) {
    if (!req.params.id)
      fail(new Error('Failed to delete comment'));
    var comment;
    Step(
      function () {
        memberDb.collections.comment.findOne({ _id:
            new ObjectID(req.params.id) }, this);
      },
      function (err, com) {
        if (err) return fail(err);
        if (!com) return fail(new Error('Comment not found'));
        comment = com;
        if (comment.member_id.toString() !== req.user._id.toString())
          return fail(new Error('Insufficient privileges'));
        memberDb.collections.comment.remove({ _id: comment._id }, this);
      },
      function (err) {
        if (err) return fail(err);
        console.log('\nDeleted comment: ' + inspect(comment) + '\n');
        memberDb.collections.post.update({ _id: comment.post_id },
                                        { $inc: { ccnt: -1 }}, {safe: true },
                                        function (err) {
          distributeUpdate('comment', 'post', 'ccnt', comment.post_id);
        });
        res.send({ status: 'success' });
        pusher.trigger(channels.all, 'comment.delete', {
          id: comment._id.toString()
        });
      }
    );
    function fail(err) {
      res.send({ status: 'error',
               message: err.stack });
    }
  });

  return exports;
}

// Scheduled tasks.
exports.jobs = function (cb) {
  return exports;
}