/*
 * Page view for crags.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/crags.html',
  'text!../../templates/crags.list.html',
  'views/lists/ticks',
  'views/lists/watchees',
  'views/session.new'
], function ($, _, Backbone, mps, rest, util, Spin, template, list, Ticks,
      Watchees, Session) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.str = null;
      this.num = 0;
      this.app = app;
      this.subscriptions = [];

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Crags');

      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');
      this.list = _.template(list);

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .list-button': 'log'
    },

    setup: function () {

      // Save refs.
      this.input = this.$('.crags-search-input input');
      this.results = this.$('.list-wrap').show();
      this.noresults = this.$('.no-results');

      // Init the load indicator.
      this.spin = new Spin(this.$('.crags-spin'));

      // Handle filtering.
      this.input.bind('keyup search', _.bind(this.search, this));

      // Render list.
      var data = this.app.profile.content.crags;
      if (data) {
        this.num = data.items.length;
        this.str = data.params.country ?
            [data.params.country, data.params.query].join(':'):
            data.params.query;
        this.input.val(this.str);
        if (data.items.length === 0) {
          this.noresults.show();
        } else {
          $(this.list.call(this, data)).appendTo(this.results);
        }
      }
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.routes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.boulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});
      this.rboulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.rroutes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      // Focus.
      if (!$('.header-search .search-display').is(':visible')) {
        this.input.focus();
      }

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
      this.crags.destroy();
      this.routes.destroy();
      this.boulders.destroy();
      this.rroutes.destroy();
      this.rboulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    search: function (e) {
      this.noresults.hide();

      // Clean search string.
      var str = util.sanitize(this.input.val());

      // Handle interaction.
      if (str === this.str) {
        if (this.num === 0 && str !== '') {
          this.noresults.show();
        }
        return false;
      }
      this.str = str;
      $('.list', this.results).remove();

      if (str === '') {
        this.app.router.navigate('crags', {trigger: false, replace: true});
        return false;
      }

      // Call server.
      this.spin.start();
      rest.post('/api/crags/search/' + str, {}, _.bind(function (err, data) {
        if (err) {
          return console.log(err);
        }
        this.spin.stop();

        // Update URL.
        var c = !data.params.country || data.params.country === '' ?
            '': '/' + data.params.country;
        var q = !data.params.query || data.params.query === '' ?
            '': '?q=' + data.params.query;
        this.app.router.navigate('crags' + c + q,
            {trigger: false, replace: true});

        // Save count.
        this.num = data.items.length;
        if (data.items.length === 0) {
          return this.noresults.show();
        }
        this.noresults.hide();

        // Render results.
        $(this.list.call(this, data)).appendTo(this.results);
        $(window).trigger('resize');
      }, this));

      return false;
    },

    log: function (e) {
      e.preventDefault();
      var cid = $(e.target).closest('li').attr('id');
      new Session(this.app, {crag_id: cid}).render();
    }

  });
});
