/*
 * Choices List view
 */

define([
  'jQuery',
  'Underscore',
  'Modernizr',
  'views/boiler/list',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/lists/choices.html',
  'collections/choices',
  'views/rows/choice'
], function ($, _, Modernizr, List, mps, rpc, util, template, Collection, Row) {
  return List.extend({
    
    el: '#header_search',
    active: false,
    str: null,
    selecting: {el: null, i: -1},

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Reset the collection.
      this.collection.reset([]);
    },

    // Bind mouse events.
    events: {
      'focus input.header-search': 'searchFocus'
    },

    // Misc. setup
    setup: function () {

      // Save refs.
      this.input = this.$('input.header-search');
      this.results = this.$('div.search-display');

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.input.placeholder();

      // Firefox fix.
      if (navigator.userAgent.indexOf('Firefox') !== -1
        || navigator.userAgent.indexOf('MSIE') !== -1)
        this.input.css({'padding-left': '5px'});

      // Handle searching.
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
      this.input.width(400).attr({placeholder: 'Search posts, members, & crags.'});
      this.active = true;
      if (this.searchVal() && this.collection.length > 0)
      this.results.show();
    },

    searchBlur: function (e) {
      if (!this.active) return;

      // Ensure we are inside input.
      if ($(e.target).hasClass('header-search')) {

        // Enter
        if (e.keyCode === 13 && e.which === 13) {
          if (this.selecting.el) {
            this.app.router.navigate(this.selecting.el.attr('href'),
                {trigger: true});
            this.input.val(this.selecting.el.data('term')).select();
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
      this.input.width(150).attr({placeholder: 'Search...'});;
      this.results.hide();
      this.resetHighlight();
      this.active = false;
    },

    searchVal: function () {
      var str = util.sanitize(this.input.val());
      return str === '' || str.length < 3 ? null: str;
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
      var types = ['crags', 'members', 'posts'];
      var done = _.after(types.length, _.bind(function () {

        // Render results.
        this._clear();
        this.resetHighlight();
        if (_.isEmpty(items)) {
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
      _.each(types, function (t) {
        rpc.post('/api/' + t + '/search/' + str, {},
            _.bind(function (err, data) {

          if (err) {

            // Oops.
            console.log('TODO: Retry, notify user, etc.');
            return;
          }
          if (data.items.length !== 0)
            items[t] = data.items;
          done();

        }, this));
      });

    },

    // Clear the collection w/out re-rendering.
    _clear: function () {
      _.each(this.views, _.bind(function (v) {
        v.destroy();
        this.collection.remove(v.model);
      }, this));
    },

  });
});
