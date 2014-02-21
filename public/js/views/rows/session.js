/*
 * Session Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rest',
  'util',
  'views/boiler/row',
  'models/session',
  'text!../../../templates/rows/session.html',
  'text!../../../templates/session.title.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html'
], function ($, _, mps, rest, util, Row, Model, template, title,
      Comments, confirm) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'session'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);

      // Allow single rendering (no parent view)
      if (!options.parentView)
        this.model = new Model(this.app.profile.content.page);

      // Boiler init.
      Row.prototype.initialize.call(this, options);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate',
      'click .session-delete': 'delete',
    },

    render: function (single, prepend) {

      Row.prototype.render.call(this, single, prepend);

      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title(this.model.name() + ' | ' + 'Session Log');

        // Render title.
        this.title = _.template(title).call(this);
      }

      // Render crag location map.
      var crag = this.model.get('crag');
      if (crag.location && crag.location.latitude
          && crag.location.longitude) {
        this.$('.session-map').show();
        cartodb.createVis('session_map_' + this.model.id,
            'https://island.cartodb.com/api/v1/viz/crags/viz.json', {
          zoom: 8,
          center_lat: crag.location.latitude,
          center_lon: crag.location.longitude,
          zoomControl: false,
          scrollwheel: false,
          cartodb_logo: false,
          https: true
        }, _.bind(function (vis, layers) {}, this));
      }

      return this;
    },

    setup: function () {
      Row.prototype.setup.call(this);

      if (!this.parentView) {

        // Set map view.
        mps.publish('map/fly', [this.model.get('location')]);
      }

      // Render comments.
      this.comments = new Comments(this.app, {parentView: this, type: 'session'});
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
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
        message: 'Do you want to delete this session log?',
        working: 'Working...'
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });
      
      // Refs.
      var overlay = $('.modal-overlay');

      // Setup actions.
      $('#confirm_cancel').click(function (e) {
        $.fancybox.close();
      });
      $('#confirm_delete').click(_.bind(function (e) {

        // Delete the session.
        rest.delete('/api/sessions/' + this.model.get('id'),
            {}, _.bind(function (err, data) {
          if (err) {

            // Oops.
            console.log('TODO: Retry, notify user, etc.');
            return;
          }

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
