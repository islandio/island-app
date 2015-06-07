/*
 * Page view for all media activity.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'text!../../templates/medias.html',
  'views/lists/medias',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees',
  'views/lists/members',
  'views/lists/ticks'
], function ($, _, Backbone, mps, util, template, Medias,
    Followers, Followees, Watchees, Members, Ticks) {
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
      this.feed = new Medias(this.app, {
        parentView: this,
        reverse: true,
        filters: false
      });
      // if (this.app.profile.member) {
        // this.followers = new Followers(this.app, {parentView: this, reverse: true});
        // this.followees = new Followees(this.app, {parentView: this, reverse: true});
        // this.crags = new Watchees(this.app, {parentView: this, reverse: true,
        //     type: 'crag', heading: 'Crags'});
        // this.routes = new Watchees(this.app, {parentView: this, reverse: true,
        //     type: 'ascent', subtype: 'r', heading: 'Routes'});
        // this.boulders = new Watchees(this.app, {parentView: this, reverse: true,
        //     type: 'ascent', subtype: 'b', heading: 'Boulders'});
        // this.recs = new Members(this.app, {parentView: this, reverse: true});
      // }
      // this.rboulders = new Ticks(this.app, {parentView: this, type: 'tick',
      //     subtype: 'b', heading: 'Boulders'});
      // this.rroutes = new Ticks(this.app, {parentView: this, type: 'tick',
      //     subtype: 'r', heading: 'Routes'});

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
      this.feed.destroy();
      // if (this.followers) {
      //   this.followers.destroy();
      // }
      // if (this.followees) {
      //   this.followees.destroy();
      // }
      // if (this.crags) {
      //   this.crags.destroy();
      // }
      // if (this.routes) {
      //   this.routes.destroy();
      // }
      // if (this.boulders) {
      //   this.boulders.destroy();
      // }
      // if (this.recs) {
      //   this.recs.destroy();
      // }
      // this.rroutes.destroy();
      // this.rboulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    setTitle: function () {
      this.app.title('The Island | Recent Media');
    }

  });
});
