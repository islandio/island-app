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
  'models/member',
  'text!../../templates/profile.html',
  'text!../../templates/profile.title.html',
  'views/lists/events',
  'views/lists/followers',
  'views/lists/followees',
  'views/lists/watchees'
], function ($, _, Backbone, mps, rest, util, Model, template, title, Events,
    Followers, Followees, Watchees) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.on('rendered', this.setup, this);
      this.subscriptions = [];

      _.bindAll(this, 'onRemoved');
      this.app.rpc.socket.on('member.removed', this.onRemoved);

      return this;
    },

    render: function () {
      this.model = new Model(this.app.profile.content.page);
      this.setTitle();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.title = _.template(title).call(this, {settings: false});

      // Check if role is company.
      if (this.model.get('role') === 2) {
        this.$el.addClass('company');
      }

      this.trigger('rendered');
      return this;
    },

    events: {},

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location') ||
          this.model.get('hometown')]);

      // Load profile image.
      if (this.model.get('image')) {
        var defaultImg = this.$('.profile-picture img:not(.masked)').show();
        var bannerImg = this.$('.profile-picture img.masked');
        var bannerURL = this.model.get('image').ssl_url ||
            this.model.get('image').cf_url ||
            this.model.get('image').url;

        var tmp = new Image();
        tmp.onload = function () {
          bannerImg.get(0).src = this.src;
          bannerImg.show();
          defaultImg.hide();
        };
        tmp.onerror = function (err) {
          // defaultImg.show();
        };
        tmp.src = bannerURL;
      }

      // Render lists.
      this.feed = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'member',
        reverse: true,
        input: this.app.profile.member &&
            this.app.profile.member.id === this.model.id,
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

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      this.app.rpc.socket.removeListener('member.removed', this.onRemoved);
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.feed.destroy();
      this.followers.destroy();
      this.followees.destroy();
      this.crags.destroy();
      this.routes.destroy();
      this.boulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    onRemoved: function (data) {
      if (data.id === this.model.id) {
        this.app.router.profile(this.model.get('username'));
      }
    },

    setTitle: function () {
      this.app.title('Island | ' + this.model.get('displayName') +
          ' (@' + this.model.get('username') + ')');
    }

  });
});
