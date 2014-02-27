/*
 * Choices List view
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'collections/choices',
  'views/rows/choice'
], function ($, _, Modernizr, List, mps, rest, util, Collection, Row) {
  return List.extend({

    active: false,
    str: null,
    selecting: {el: null, i: -1},

    initialize: function (app, options) {
      this.app = app;
      this.collection = new Collection;
      this.Row = Row;
      this.options = options;
      if (!this.options.query) this.options.query = {};
      this.setElement(options.el);

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Reset the collection.
      this.collection.reset([]);
    },

    // Mouse events.
    events: {
      'click .search-choice-clear': 'clearChoice',
    },

    // Misc. setup
    setup: function () {

      // Save refs.
      this.input = this.$('input');
      this.results = this.$('.search-display');
      this.choiceWrap = this.$('.search-choice');
      this.choiceContent = this.$('.search-choice-content');

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.input.placeholder();

      // Handle searching.
      this.autocomplete = new google.maps.places.AutocompleteService();
      // this.geocoder = new google.maps.Geocoder();
      this.places = new google.maps.places.PlacesService($('<div>').get(0));
      this.input.bind('focus', _.bind(this.searchFocus, this));
      this.input.bind('keyup', _.bind(this.search, this));
      this.input.bind('keydown', _.bind(this.searchBlur, this));
      $(document).on('mouseup', _.bind(this.searchBlur, this));

      return List.prototype.setup.call(this);
    },

    highlight: function () {
      this.selecting.el = this.$('a.choice').eq(this.selecting.i);
      this.$('a.choice').removeClass('hover');
      this.selecting.el.addClass('hover');
      var h = this.selecting.el.outerHeight() - 1;
      var be = h + this.selecting.el.offset().top - this.results.offset().top - 1;
      var H = this.results.height();
      var s = this.results.scrollTop();
      if (be > H)
        this.results.scrollTop(this.results.scrollTop() + h);
      else if (be < h)
        this.results.scrollTop(this.results.scrollTop() - h);
    },

    resetHighlight: function () {
      this.selecting = {el: null, i: -1};
      this.results.scrollTop(0);
    },

    searchFocus: function (e) {
      if (this.options.collapse)
        this.input.width(338).attr({placeholder: this.options.placeholder});
      this.active = true;
      if (this.searchVal() && this.collection.length > 0)
      this.results.show();
    },

    searchBlur: function (e) {
      if (!this.active) return;

      // Ensure we are inside input.
      if ($(e.target).hasClass(this.input.attr('class'))) {

        // Enter
        if (e.keyCode === 13 && e.which === 13) {
          if (this.selecting.el) {
            this.views[this.selecting.el.index() - 1].choose();
            if (!this.options.choose)
              this.input.select();
            return false;
          }
        }

        // If tab, then proceed with blur.
        else if (e.keyCode !== 9 && e.which !== 9) {

          // Up
          if (e.keyCode === 38 && e.which === 38) {
            if (this.selecting.i > 0) {
              this.selecting.i--;
              this.highlight();
            }
            return false;
          }

          // Down
          else if (e.keyCode === 40 && e.which === 40) {
            if (this.selecting.i < this.collection.length - 1) {
              this.selecting.i++;
              this.highlight();
            }
            return false;
          }

          return;
        }
      }

      // Blur.
      if (!this.searchVal() && this.options.collapse)
        this.input.width(198).attr({placeholder: 'Search...'});
      this.results.hide();
      this.resetHighlight();
      this.active = false;
    },

    searchVal: function () {
      var str = util.sanitize(this.input.val());
      return str === '' || str.length < 2 ? null: str;
    },

    search: function (e) {

      // Clean search string.
      var str = this.searchVal();

      // Handle interaction.
      if (str && str === this.str) return;
      this.str = str;
      if (!str) {
        this._clear();
        this.resetHighlight();
        return this.results.hide();
      }

      // Setup search types.
      var items = {};
      var types = this.options.types;
      var done = _.after(types.length, _.bind(function () {

        // Render results.
        this._clear();
        this.resetHighlight();
        if (_.isEmpty(items)) {
          this.results.hide();
          return;
        } else if (!_.find(items, function (i) { return i.length !== 0; })) {
          this.results.hide();
          return;
        }
        
        // Add to collection.
        _.each(types, _.bind(function (t) {
          if (items[t])
            _.each(items[t], _.bind(function (i) {
              this.collection.unshift(i);
            }, this));
        }, this));

        // Show results display.
        this.results.show();
      }, this));

      // Perform searches.
      _.each(types, _.bind(function (t) {
        if (t !== 'places')
          rest.post('/api/' + t + '/search/' + str, this.options.query,
              _.bind(function (err, data) {
            if (err) return console.log(err);

            if (data.items.length !== 0)
              items[t] = data.items;
            done();

          }, this));
        else
          this.autocomplete.getPlacePredictions({input: str},
              _.bind(function (preds, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK
              || preds.length === 0)
              return done();
            var _done = _.after(preds.length, done)
            items.places = [];
            _.each(preds, _.bind(function (p) {
              this.places.getDetails({reference: p.reference},
                  _.bind(function (place, stat) {
                if (stat !== google.maps.places.PlacesServiceStatus.OK)
                  return _done();
                items.places.push(place);
                _done();
              }, this));
            }, this));
          }, this));
      }, this));

    },

    // Clear the collection w/out re-rendering.
    _clear: function () {
      _.each(this.views, _.bind(function (v) {
        v.destroy();
        this.collection.remove(v.model);
      }, this));
    },

    choose: function (choice) {
      if (!this.options.choose) return;
      this.choiceContent.html(choice.$el.html());
      this.choiceWrap.show();
      this.results.hide();
      this.choice = choice;
      this.input.val('');
      if (this.options.onChoose)
        this.options.onChoose();
    },

    clearChoice: function (e) {
      this.choiceWrap.hide();
      this.choice = null;
      this.input.focus();
      if (this.options.onChoose)
        this.options.onChoose();
    },

  });
});
