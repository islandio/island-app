/*
 * Media Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'util',
  'views/boiler/row',
  'models/media',
  'text!../../../templates/rows/media.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, util, Row, Model, template, Comments, confirm) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'media'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Boiler init.
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .media-delete': 'delete'
    },

    setup: function () {
      Row.prototype.setup.call(this);

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, type: 'media'});
    },

    destroy: function () {
      this.comments.destroy();
      Row.prototype.destroy.call(this);
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    delete: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this video forever?',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {

        // Delete the media.
        rest.delete('/api/medias/' + this.model.id,
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // close the modal.
          $.fancybox.close();

        }, this));

        // Remove from UI.
        this.parentView._remove({id: this.model.id});

      }, this));

      return false;
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
