/*
 * comment.js: Handling for the comment resource.
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
    "body": <String>,
    "likes": <Number>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

// Do any initializations
exports.init = function () {
  return this.routes();
};

// Define routes.
exports.routes = function () {
  var db = app.get('db');
  var errorHandler = app.get('errorHandler');
  var events = app.get('events');

  // List
  app.post('/api/comments/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 5;
    var skip = req.body.skip || cursor * limit;
    var query = {};

    if (req.body.author_id) {
      query.author_id = db.oid(req.body.author_id);
    }
    if (req.body.parent_id) {
      query.parent_id = db.oid(req.body.parent_id);
    }

    db.Comments.list(query, {sort: {created: -1}, limit: limit,
        skip: skip, inflate: {author: profiles.member}},
        function (err, comments) {
      if (errorHandler(err, req, res)) return;

      res.send(iutil.client({
        comments: {
          cursor: ++cursor,
          more: comments && comments.length === limit,
          items: comments
        }
      }));
    });
  });

  // Create
  app.post('/api/comments/:type', function (req, res) {
    if (!req.body.body || req.body.body === '' ||
        !req.body.parent_id) {
      return res.send(403, {error: 'Comment invalid'});
    }
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    var type = req.params.type;
    var typeResource = _.capitalize(type) + 's';
    var props = req.body;
    props.author_id = req.user._id;
    props.parent_type = type;

    // Parent type could be post, tick, crag, ascent.
    var inflate = {author: profiles.member};
    switch (type) {
      case 'post':
        break;
      case 'tick':
        inflate.ascent = profiles.ascent;
        break;
    }

    var mentions = iutil.atmentions(props.body);
    var mentionDocs;

    // Get the comment's parent.
    db[typeResource].read({_id: db.oid(props.parent_id)},
        {inflate: inflate}, function (err, parent) {
      if (errorHandler(err, req, res, parent, 'parent')) return;

      Step(
        function() {
          var group = this.group();
          _.each(mentions, function(m) {
            db.Members.read({username: m}, group());
          });
        },
        function (err, _mentionDocs) {
          if (err) return this(err);
          mentionDocs = _mentionDocs;
 
          for (var i = 0; i < mentions.length; i++) {
            if (mentionDocs[i]) {
              props.body = props.body.replace('@' + mentions[i],
                  '\u0091' + '@' + mentions[i] + '\u0092')
            }
          }
         
          // Create the comment.
          props.parent_id = parent._id;
          db.Comments.create(props, {inflate: {author: profiles.member}},
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
                target.s = ['efforts', parent.key].join('/');
                break;
            }
            target.s += '#c=' + doc._id.toString();

            // Notify only if public.
            var notify = {};
            if (parent.public !== false) {
              notify = {subscriber: true};
            }

            // Publish comment.
            events.publish('comment', 'comment.new', {
              data: doc,
              event: {
                actor_id: req.user._id,
                target_id: parent._id,
                action_id: doc._id,
                action_type: 'comment',
                data: {
                  action: {
                    i: req.user._id.toString(),
                    a: req.user.displayName,
                    g: req.user.gravatar,
                    t: 'comment',
                    b: _.prune(doc.body, 40)
                  },
                  target: target
                },
                public: parent.public !== false
              },
              options: {method: 'DEMAND_WATCH_SUBSCRIPTION'},
              notify: notify
            });

            // Subscribe actor to future events on this parent.
            events.subscribe(req.user, parent, {style: 'watch', type: type});
             
            // Mentions
            _.each(mentionDocs, function(mem) {
              if (!mem) return;
              var meta = {
                style: 'mention',
                type: 'comment',
                mentioner: req.user,
                target: target
              };
              events.subscribe(mem, doc, meta);
            });
            
            // Finish.
            res.send({id: doc._id.toString()});
          });
        }
      );
    });

  });

  // Update (TODO)
  app.put('/api/comments/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: 'Member invalid'});
    }

    res.send();
  });

  // Delete
  app.delete('/api/comments/:id', function (req, res) {
    if (!req.user) {
      return res.send(403, {error: {message: 'Member invalid'}});
    }

    // Delete the comment.
    function _delete(doc, cb) {
      Step(
        function () {

          // Remove notifications for events where comment is action.
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

          // Remove events where comment is action.
          db.Events.remove({action_id: doc._id}, this.parallel());

          // Finally, remove the comment.
          db.Comments.remove({_id: doc._id}, this.parallel());
        },
        function (err) {
          cb(err);

          // Publish removed status.
          if (!err) {
            events.publish('commment', 'comment.removed',
                {data: {id: req.params.id}});
          }
        }
      );
    }

    Step(
      function () {
        var id = db.oid(req.params.id);

        // Get comment.
        db.Comments.read({_id: id, author_id: req.user._id}, this);
      },
      function (err, comment) {
        if (errorHandler(err, req, res, comment, 'comment')) return;
        _delete(comment, this);
      },
      function (err) {
        if (errorHandler(err, req, res)) return;
        res.send({removed: true});
      }
    );
  });

  return exports;
};
