/*
 * Choices List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'collections/choices',
  'views/rows/choice'
], function ($, _, List, mps, rest, util, Collection, Row) {
  return List.extend({

    initialize: function (app, options) {
      this.app = app;
      this.active = false;
      this.str = null;
      this.selecting = {el: null, i: -1};
      this.collection = new Collection();
      this.Row = Row;
      this.options = options;
      if (!this.options.query) {
        this.options.query = {};
      }
      this.setElement(options.el);
      this.subscriptions = [];

      List.prototype.initialize.call(this, app, options);

      this.collection.reset([]);
    },

    events: {
      'click .search-choice-clear': 'clearChoice',
    },

    setup: function () {

      // Save refs.
      this.input = this.$('input');
      this.results = this.$('.search-display');
      this.choiceWrap = this.$('.search-choice');
      this.choiceContent = this.$('.search-choice-content');

      // Let us develop if google API wasn't downloaded
      //
      if (typeof google !== 'undefined') {
        // Handle searching.
        this.autocomplete = new google.maps.places.AutocompleteService();
        this.places = new google.maps.places.PlacesService($('<div>').get(0));
      }
      // this.geocoder = new google.maps.Geocoder();
      this.input.bind('focus', _.bind(this.searchFocus, this));
      this.input.bind('keyup', _.bind(this.search, this));
      this.input.bind('keydown', _.bind(this.searchBlur, this));
      // search event only used to handle clearing html5 search
      this.input.bind('search', _.bind(this.handleClear, this));
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
      if (be > H) {
        this.results.scrollTop(this.results.scrollTop() + h);
      } else if (be < h) {
        this.results.scrollTop(this.results.scrollTop() - h);
      }
    },

    resetHighlight: function () {
      this.selecting = {el: null, i: -1};
      this.results.scrollTop(0);
    },

    searchFocus: function (e) {
      if (this.options.collapse) {
        this.input.width(308).attr({placeholder: this.options.placeholder});
      }
      this.active = true;
      if (this.searchVal() && this.collection.length > 0) {
        this.results.show();
      }
    },

    up: function() {
      if (this.selecting.i > 0) {
        this.selecting.i--;
        this.highlight();
      }
    },

    down: function() {
      if (this.selecting.i < this.collection.length - 1) {
        this.selecting.i++;
        this.highlight();
      }
    },

    // Force a choice externally
    chooseExternal: function() {
      if (this.selecting.el) {
        this.views[this.selecting.el.index() - 1].choose();
      }
    },

    searchBlur: function (e) {
      if (!this.active) return;

      // Ensure we are inside input.
      if ($(e.target).hasClass(this.input.attr('class'))) {

        // Enter
        if (e.keyCode === 13 && e.which === 13) {
          if (this.selecting.el) {
            this.views[this.selecting.el.index() - 1].choose();
            // if (!this.options.choose) {
            //   this.input.blur();
            //   this.results.hide();
            // }
            return false;
          }
        }

        // If tab, then proceed with blur.
        else if (e.keyCode !== 9 && e.which !== 9) {

          // Up
          if (e.keyCode === 38 && e.which === 38) {
            this.up();
            return false;
          }

          // Down
          else if (e.keyCode === 40 && e.which === 40) {
            this.down();
            return false;
          }

          return;
        }
      }

      // Blur.
      if (!this.searchVal() && this.options.collapse) {
        this.input.width(198).attr({placeholder: 'Search...'});
      }
      this.results.hide();
      //this.resetHighlight();
      this.active = false;
    },

    searchVal: function () {
      var str = util.sanitize(this.input.val());
      return str === '' || str.length < 2 ? null: str;
    },

    hide: function() {
      this.str = null;
      this._clear();
      this.results.hide();
    },

    count: function() {
      return this.collection.length;
    },

    search: function (e, optionalString) {


      // Clean search string.
      var str = (optionalString === null || optionalString === undefined) ?
          this.searchVal() : optionalString;

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
        var opts = { gradeConverter: this.app.gradeConverter };
        _.each(types, _.bind(function (t) {
          if (items[t]) {
            _.each(items[t], _.bind(function (i) {
              this.collection.unshift(i, opts);
            }, this));
          }
        }, this));

        // Show results display.
        this.results.show();
        this.selecting.i++;
        this.highlight();
      }, this));

      // Perform searches.
      _.each(types, _.bind(function (t) {
        if (t !== 'places') {
          rest.post('/api/' + t + '/search/' + str, this.options.query,
              _.bind(function (err, data) {
            if (err) return console.log(err);

            if (data.items.length !== 0) {
              _.each(data.items, function (i) { i._type = t; });
              items[t] = data.items;
            }
            done();
          }, this));
        } else {
          if (!this.autocomplete) done();
          this.autocomplete.getPlacePredictions({input: str},
              _.bind(function (preds, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK ||
              preds.length === 0) {
              return done();
            }
            var _done = _.after(preds.length, done);
            items.places = [];
            _.each(preds, _.bind(function (p) {
              this.places.getDetails({reference: p.reference},
                  _.bind(function (place, stat) {
                if (stat !== google.maps.places.PlacesServiceStatus.OK) {
                  return _done();
                }
                items.places.push(place);
                _done();
              }, this));
            }, this));
          }, this));
        }
      }, this));

    },

    // Clear the collection w/out re-rendering.
    _clear: function () {
      _.each(this.views, _.bind(function (v) {
        v.destroy();
        this.collection.remove(v.model);
      }, this));
    },

    choose: function (choice, fixed) {
      if (!this.options.choose) {
        this.input.blur();
        this.results.hide();
        return;
      }
      this.choiceContent.html(choice.$el.html());
      if (fixed) {
        this.choiceWrap.addClass('fixed');
      }
      this.choiceWrap.show();
      this.results.hide();
      this.choice = choice;
      this.input.val('');
      if (this.options.onChoose) {
        this.options.onChoose(choice.model);
      }
    },

    preChoose: function (opts, fixed) {
      rest.get('/api/' + opts.type + '/' + opts.id, {},
          _.bind(function (err, data) {
        if (err) {
          return console.log(err);
        }

        data._type = opts.type;
        this.collection.unshift(data, { gradeConverter: this.app.gradeConverter });
        this.choose(this.views[0], fixed);
      }, this));
    },

    clearChoice: function (e) {
      this.choiceWrap.hide();
      this.choice = null;
      if (e) {
        this.input.focus();
        if (this.options.onChoose) {
          this.options.onChoose();
        }
      }
    },

    handleClear: function(e) {
      if (this.input.val() === '') {
        this.hide();
      }
    }

  });
});
