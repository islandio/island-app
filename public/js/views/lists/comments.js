/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment',
  'views/lists/hangtens'
], function ($, _, List, mps, rest, util, template, Collection, Row, Hangtens) {
  return List.extend({
    
    el: '.comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.options = options;
      this.type = options.type;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      if (!this.options.hangtenOnly) {

        // Socket subscriptions
        _.bindAll(this, 'collect', '_remove');
        this.app.rpc.socket.on('comment.new', this.collect);
        this.app.rpc.socket.on('comment.removed', this._remove);
      }

        // Reset the collection.
      var list = this.parentView.model.get('comments') || [];
      var cnt = this.parentView.model.get('comments_cnt') || 0;
      this.collection.older = cnt - list.length;
      this.collection.reset(list);
    },

    setup: function () {

      // Save refs.
      this.footer = this.$('.list-footer');
      this.inputWrap = this.$('#comment_input .comment');

      if (!this.options.hangtenOnly) {

        // Autogrow the write comment box.
        this.$('textarea[name="body"]').autogrow();
        this.$('textarea[name="body"]')
            .bind('keyup', _.bind(function (e) {
          if (!e.shiftKey && (e.keyCode === 13 || e.which === 13)) {
            this.write();
          }
        }, this)).bind('keydown', _.bind(function (e) {
          if (!e.shiftKey && (e.keyCode === 13 || e.which === 13)) {
            return false;
          }
        }, this));

        // Show other elements.
        this.$('.comments-older.comment').show();
        if (!this.options.hideInput) {
          this.inputWrap.show();
        } else {
          this.parentView.$('.toggle-comment-input').click(_.bind(function (e) {
            e.preventDefault();
            if (this.inputWrap.is(':visible')) {
              this.inputWrap.hide();
            } else {
              this.inputWrap.show();
              this.$('textarea.comment-input').focus();
            }
          }, this));
        }
      }

      // Render hangtens.
      this.hangtens = new Hangtens(this.app, {parentView: this});

      return List.prototype.setup.call(this);
    },

    destroy: function () {
      this.app.rpc.socket.removeListener('comment.new', this.collect);
      this.app.rpc.socket.removeListener('comment.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    // Bind mouse events.
    events: {
      'click .comments-signin': 'signin',
      'click .comments-older': 'older'
    },

    // Collect new data from socket events.
    collect: function (data) {
      if (data.parent_id === this.parentView.model.id
          && !this.collection.get(-1)) {
        this.collection.push(data);
      }
    },

    // remove a model
    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
        }, this));
      }
    },

    //
    // Optimistically writes a comment.
    //
    // This function assumes that a comment will successfully be created on the
    // server. Based on that assumption we render it in the UI before the 
    // success callback fires.
    //
    // When the success callback fires, we update the comment model id from the
    // comment created on the server. If the error callback fires, we remove 
    // the comment from the UI and notify the user (or retry).
    //
    write: function (e) {
      if (e) e.preventDefault();

      var form = $('form.comment-input-form', this.el);
      var input = this.$('textarea.comment-input');
      input.val(util.sanitize(input.val()));
      if (input.val().trim() === '') return;

      // For server.
      var payload = form.serializeObject();
      payload.body = util.sanitize(payload.body);

      // Mock comment.
      var data = {
        id: -1,
        author: this.app.profile.member,
        body: payload.body,
        created: new Date().toISOString()
      };

      // Add the parent id.
      payload.parent_id = this.parentView.model.id;

      // Optimistically add comment to page.
      this.collection.push(data);
      input.val('').keyup();

      // Now save the comment to server.
      rest.post('/api/comments/' + this.type, payload,
          _.bind(function (err, data) {
        if (err) {
          this.collection.pop();
          return console.log(err);
        }

        // Update the comment id.
        var comment = this.collection.get(-1);
        comment.set('id', data.id);
        this.$('#-1').attr('id', data.id);

        if (this.options.hideInput) {
          // this.inputWrap.hide();
        }

      }, this));

      return false;
    },

    older: function (e) {

      var limit = this.collection.older;
      this.collection.older = 0;

      // Get the older comments.
      rest.post('/api/comments/list', {
        skip: this.collection.length,
        limit: limit,
        parent_id: this.parentView.model.id,
      }, _.bind(function (err, data) {
        if (err) return console.log(err);

        // Update the collection.
        var ids = _.pluck(this.collection.models, 'id');
        this.collection.options.reverse = true;
        var i = 0;
        _.each(data.comments.items, _.bind(function (c) {
          if (!_.contains(ids, c.id)) {
            this.collection.unshift(c);
            ++i;
          }
        }, this));
        this.collection.options.reverse = false;

        // Hide the button.
        this.$('.comments-older.comment').hide();
      }, this));

    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('member/signin/open');
    }

  });
});
