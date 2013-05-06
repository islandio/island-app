/*
 * Page view for a member profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps',
  'util',
  'models/member',
  'views/lists/comments',
  'views/lists/posts'
], function ($, _, Backbone, rpc, mps, util, Member, Comments, Posts) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#main',

    // Module entry point:
    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Subscriptions:
      // this.subscriptions = [
      //   mps.subscribe('currency/investment', _.bind(this.investment, this))
      // ];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Member(this.app.profile.get('content').member);

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // // Grab content:
      // var content = this.app.profile.get('content');

      // // Autogrow the write comment box.
      // this.$('textarea[name="content"]').autogrow();
      // this.$('textarea[name="content"]').bind('keyup', _.bind(function (e) {
      //   if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
      //     this.writeComment();
      // }, this));

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, reverse: true});

      // Render posts.
      this.posts = new Posts(this.app, {parentView: this, reverse: true});

      // // Show the write comment box.
      // this.$('#comment_input .comment').show();
      // this.$('textarea[name="content"]').focus();

      // return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    // Bind mouse events.
    events: {
      'click .action-button': 'writeComment'
    },

    /**
     * Optimistically writes a comment.
     *
     * This function assumes that a comment will successfully be created on the
     * server. Based on that assumption we render it in the UI before the 
     * success callback fires.
     *
     * When the success callback fires, we update the comment model id from the
     * comment created on the server. If the error callback fires, we remove 
     * the comment from the UI and notify the user (or retry).
     */
    writeComment: function (e) {
      if (e) e.preventDefault();
      var input = this.$('textarea.comment-input');
      if (input.val().trim() === '')
        return;
      var form = this.$('form.comment-input-form');
      var payload = form.serializeObject(); // For server.
      var person = this.app.profile.get('person');
      var created = new Date().toISOString();
      var data = { // Our mock comment.
        id: -1,
        content: payload.content,
        owner_name: person.name, 
        created: created, 
        owner_username: person.username,
      };

      // Add the parent shell's id.
      payload.parent_id = this.app.profile.get('page').shell.idea ?
                          this.app.profile.get('page').shell.idea.id:
                          this.app.profile.get('page').shell.campaign.id;

      // Optimistically add comment to page:
      this.comments.collection.unshift(data);
      input.val('').keyup();

      // Now save the comment to server:
      rpc.execute('/service/comment.create', payload, {
        success: _.bind(function (data) {

          // All good, just update the comment id.
          var id = data.id;
          var comment = this.comments.collection.get(-1);
          comment.set('id', id);

        }, this),
        error: _.bind(function (error, status) {

          // Oops, comment wasn't created.
          console.log("TODO: Retry, notify user, etc.");
          this.comments.collection.pop();

        }, this),
      });

      return false;
    },

  });
});