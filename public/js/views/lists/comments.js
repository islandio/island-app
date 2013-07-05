/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment'
], function ($, _, List, mps, rpc, util, template, Collection, Row) {
  return List.extend({
    
    el: '.comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.socket.subscribe('post-' + this.parentView.model.id)
          .bind('comment.new', _.bind(this.collect, this));

      // Reset the collection.
      this.collection.reset(this.parentView.model.get('comments'));
    },

    setup: function () {

      // Autogrow the write comment box.
      this.$('textarea[name="body"]').autogrow();
      this.$('textarea[name="body"]').bind('keyup', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          this.write();
      }, this));

      // Show the write comment box.
      this.$('#comment_input .comment').show();

      return List.prototype.setup.call(this);
    },

    // Bind mouse events.
    events: {
      'click .comments-signin': 'signin'
    },

    // Collect new comments from socket events.
    collect: function (comment) {
      this.collection.unshift(comment);
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
      this.collection.unshift(data);
      input.val('').keyup();

      // Now save the comment to server.
      rpc.post('/api/comments/post', payload,
          _.bind(function (err, data) {

        if (err) {

          // Oops, comment wasn't created.
          console.log('TODO: Retry, notify user, etc.');
          this.collection.pop();
          return;
        }

        // Update the comment id.
        var comment = this.collection.get(-1);
        comment.set('id', data.id);
        this.$('#-1').attr('id', data.id);

      }, this));

      return false;
    },

    signin: function (e) {
      e.preventDefault();

      // Render the signin view.
      mps.publish('member/signin/open');
    }

  });
});
