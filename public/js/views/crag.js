/*
 * Page view for a crag profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/crag',
  'text!../../templates/crag.html',
  'text!../../templates/crag.title.html',
  'views/lists/events'
], function ($, _, Backbone, mps, rest, util, Crag, template, title, Events) {

  return Backbone.View.extend({

    // The DOM target element for this page
    el: '.main',

    // Module entry point
    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Crag(this.app.profile.content.page);

      // Save ref to flattened lists for filtering.
      this.flattened = {};
      _.each(this.model.get('ascents'), _.bind(function (ascents, t) {
        this.flattened[t] = _.flatten(ascents);
      }, this));

      // Set page title.
      this.app.title('Island | ' + [this.model.get('name'),
          this.model.get('country')].join(', '));

      // Render title.
      this.title = _.template(title).call(this);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ascents-filter-input input');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ascents');
      this.routes = this.$('.r-ascents');

      // Handle type changes.
      if (this.model.get('bcnt') > this.model.get('rcnt')) {
        this.currentType = 'b';
        this.bouldersFilter.addClass('active');
        this.boulders.show();
      } else {
        this.currentType = 'r';
        this.routesFilter.addClass('active');
        this.routes.show();
      }
      this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
      this.routesFilter.click(_.bind(this.changeType, this, 'r'));

      // Disable types if nothing to show.
      if (this.model.get('bcnt') === 0)
        this.bouldersFilter.addClass('disabled');
      if (this.model.get('rcnt') === 0)
        this.routesFilter.addClass('disabled');

      // Handle filtering.
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      // Focus.
      if (!$('.header-search .search-display').is(':visible'))
        this.filterBox.focus();

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render events.
      this.events = new Events(this.app, {
        parentView: this,
        parentId: this.model.id,
        parentType: 'crag',
        reverse: true,
        input: true
      });

      return this;
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
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    changeType: function (type, e) {

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active') || chosen.hasClass('disabled')) return;
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Set new type.
      this.currentType = type;
      this.$('.list-wrap').hide();
      this.$('.' + this.currentType + '-ascents').show();
      this.filterBox.keyup();
    },

    filter: function (e) {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      $('.' + ct + '-ascents .no-results').hide();
      if (txt === '') {
        $('.' + ct + '-ascents .list a').show();
        $('.' + ct + '-ascents .list-group-heading').show();
        return false;
      }
      $('.' + ct + '-ascents .list a').hide();
      $('.' + ct + '-ascents .list-group-heading').hide();
      var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      var y = false;
      _.each(this.flattened[ct], function (a) {
        if (rx.test(a.name)) {
          y = true;
          var d = $('.' + ct + '-ascents .list a[id="' + a.id + '"]');
          d.show();
          $('.list-group-heading', d.parent()).show();
        }
      });
      if (!y) $('.list-wrap .no-results').show();
      return false;
    }

  });
});
