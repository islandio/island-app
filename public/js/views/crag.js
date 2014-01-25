/*
 * Page view for a crag profile.
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'models/crag',
  'text!../../templates/crag.html',
  'views/lists/events'
], function ($, _, Modernizr, Backbone, mps, rpc, util, Crag, template, Events) {

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

      // Set page title
      var title = [this.model.get('name'),
          this.model.get('country')].join(', ');
      this.app.title(title);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .navigate': 'navigate',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.filterBox = this.$('.filter-box');
      this.bouldersFilter = this.$('.b-filter');
      this.routesFilter = this.$('.r-filter');
      this.boulders = this.$('.b-ascents');
      this.routes = this.$('.r-ascents');

      // Handle type changes.
      if (this.model.get('bcnt') > this.model.get('rcnt')) {
        this.currentType = 'b';
        this.bouldersFilter.addClass('selected');
        this.boulders.show();
      } else {
        this.currentType = 'r';
        this.routesFilter.addClass('selected');
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
      this.filterBox.width(441).css('visibility', 'visible');
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.filterBox.placeholder();

      // Focus.
      if (!$('.header-search .search-display').is(':visible'))
        this.filterBox.focus();

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render lists.
      this.events = new Events(this.app, {parentView: this, reverse: true});

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
      this.events.destroy();
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
      var t = $(e.target);
      if (t.hasClass('disabled')
            || t.hasClass('selected')) return false;
      this.currentType = type;
      this.$('.ascent-filter-buttons a.button').removeClass('selected');
      t.addClass('selected');
      this.$('.ascents-wrap').hide();
      this.$('.' + this.currentType + '-ascents').show();
      this.filterBox.keyup();
    },

    filter: function (e) {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      $('.' + ct + '-ascents span.no-results').hide();
      if (txt === '') {
        $('.' + ct + '-ascents ul.ascents a').show();
        $('.' + ct + '-ascents span.grade-heading').show();
        return false;
      }
      $('.' + ct + '-ascents ul.ascents a').hide();
      $('.' + ct + '-ascents span.grade-heading').hide();
      var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      var y = false;
      _.each(this.flattened[ct], function (a) {
        if (rx.test(a.name)) {
          y = true;
          var d = $('.' + ct + '-ascents ul.ascents a[id="' + a.id + '"]');
          d.show();
          $('span.grade-heading', d.parent()).show();
        }
      });
      if (!y) $('div.ascents-wrap span.no-results').show();
      return false;
    }

  });
});
