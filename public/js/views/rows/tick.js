/*
 * Tick View
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/tick',
  'text!../../../templates/rows/tick.html',
  'text!../../../templates/tick.title.html',
  'views/lists/comments',
  'text!../../../templates/confirm.html'
], function ($, _, Backbone, mps, rest, util, Model, template, title, Comments,
      confirm) {
  return Backbone.View.extend({

    attributes: function () {
      var attrs = {class: 'tick'};
      if (this.model) attrs.id = this.model.id;
      return attrs;
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(options.model || this.app.profile.content.page);
      this.parentView = options.parentView;
      this.wrap = options.wrap;
      this.template = _.template(template);

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click a.navigate': 'navigate',
      'click .tick-delete': 'delete',
    },

    render: function () {

      // Render content
      this.$el.html(this.template.call(this));
      if (this.parentView)
        this.$el.prependTo(this.parentView.$('.event-right'));
      else this.$el.appendTo(this.wrap);

      // Render title if single
      if (!this.parentView) {
        this.$el.addClass('single')
        this.app.title(this.model.formatName() + ' | ' + 'Tick');

        // Render title.
        this.title = _.template(title).call(this);
      }

      // Render crag location map.
      var crag = this.model.get('crag');
      if (crag.location && crag.location.latitude
          && crag.location.longitude) {
        this.$('.tick-map').show();
        cartodb.createVis('tick_map_' + this.model.id,
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

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Set map view.
      if (!this.parentView)
        mps.publish('map/fly', [this.model.get('crag').location]);

      // Render comments.
      this.comments = new Comments(this.app, {
        parentView: this,
        type: 'tick'
      });

      // Handle time.
      this.timer = setInterval(_.bind(this.when, this), 5000);
      this.when();
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      if (this.timer)
        clearInterval(this.timer);
      this.remove();
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
        message: 'Delete this tick forever?',
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

        // Delete the session.
        rest.delete('/api/ticks/' + this.model.id,
            {}, _.bind(function (err, data) {
          if (err) return console.log(err);

          // close the modal.
          $.fancybox.close();

          // Go home if single view.
          if (!this.parentView)
            this.app.router.navigate('/', {trigger: true, replace: true});

        }, this));

      }, this));

      return false;
    },

    when: function () {
      if (!this.model.get('created')) return;
      if (!this.time)
        this.time = this.$('time.created:first');
      this.time.text(util.getRelativeTime(this.model.get('created')));
    },

  });
});
