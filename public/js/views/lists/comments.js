/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '.comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Shell subscriptions:
      // this.subscriptions = [
      //   mps.subscribe('comment/new', _.bind(this.collect, this)),
      // ];

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Reset the collection with the appropriate list.
      var items = this.app.profile.get('content').comments ?
                  this.app.profile.get('content').comments.items : [];
      this.collection.reset(items);
    },

    setup: function () {


      // Autogrow the write comment box.
      this.$('textarea[name="body"]').autogrow();
      this.$('textarea[name="body"]').bind('keyup', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          this.writeComment();
      }, this));

      // Show the write comment box.
      this.$('#comment_input .comment').show();

      return List.prototype.setup.call(this);

    },

    // Handle bus events from subscription.
    collect: function (data) {
      // var id = this.app.profile.get('content').shell.idea ?
      //          this.app.profile.get('content').shell.idea.id:
      //          this.app.profile.get('page').shell.campaign.id;
      // if (id === data.parent_id)
      //   this.collection.unshift(data);
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
      rpc.exec('/comments', payload, {
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

// <div id="comment_input">
//   <% if (person) { %>
//     <div class="comment">
//       <a href="/<%= person.username %>" class="comment-avatar">
//         <% if (person.avatar_url) { %>
//           <img src="<%= person.avatar_url %>" width="32" height="32" />
//         <% } else { %>
//           <img src="<%= static %>/img/avatar_32.png" width="32" height="32" />
//         <% } %>
//       </a>
//       <div class="comment-content">
//         <form enctype="multipart/form-data" method="POST" class="comment-input-form">
//           <textarea name="content" class="comment-input" 
//               placeholder="Write a comment ..."></textarea>
//         </form>
//       </div>
//     </div>
//   <% } else { %>
//     <a href="/login">
//       <span class="loading">Please login to comment.</span>
//     </a>
//   <% } %>
// </div>
