/*
 * Page view for all activity.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/dashboard.html',
  'views/lists/events',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees',
  'views/lists/members'
], function ($, _, Backbone, mps, util, template, Events,
    Followers, Followees, Watchees, Members) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.setTitle();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');

      return this;
    },

    setup: function () {

      // Render lists.
      this.events = new Events(this.app, {
        parentView: this,
        reverse: true,
        input: true,
        filters: ['session', 'post', 'crag', 'ascent'],
        hide: ['crag', 'ascent']
      });
      this.followers = new Followers(this.app, {parentView: this, reverse: true});
      this.followees = new Followees(this.app, {parentView: this, reverse: true});
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.routes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.boulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});
      this.recs = new Members(this.app, {parentView: this, reverse: true});

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.events.destroy();
      this.followers.destroy();
      this.followees.destroy();
      this.crags.destroy();
      this.routes.destroy();
      this.boulders.destroy();
      this.recs.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    setTitle: function () {
      var name = this.app.profile.member.displayName;
      this.app.title('The Island | ' + name + ' - Home');
    }

  });
});
