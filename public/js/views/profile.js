/*
 * Profile view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/profile',
  'text!../../../templates/profile.html',
  'text!../../../templates/profile.title.html',
  'views/lists/events'
], function ($, _, Backbone, mps, rest, util, Model, template, title, Events) {
  return Backbone.View.extend({

    attributes: function () {
      return {class: 'profile'};
    },

    initialize: function (options, app) {
      this.app = app;
      this.model = new Model(this.app.profile.content.page);
      this.wrap = options.wrap;
      this.template = _.template(template);

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions.
      this.subscriptions = [];

      return this;
    },

    events: {
      'click .navigate': 'navigate',
    },

    render: function () {

      // Render content.
      this.$el.html(this.template.call(this)).appendTo(this.wrap).show();

      // Set page title
      if (this.model.get('role') === 2)
        this.$el.addClass('company');
      var doctitle = 'Island | ' + this.model.get('displayName');
      doctitle += ' (@' + this.model.get('username') + ')';
      this.app.title(doctitle);

      // Render title.
      this.title = _.template(title).call(this);

      // Trigger setup.
      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location') 
          || this.model.get('hometown')]);

      // Render events.
      this.events = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'member',
        reverse: true,
        input: this.app.profile.member
            && this.app.profile.member.id === this.model.id
      });

      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.events.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

  });
});
