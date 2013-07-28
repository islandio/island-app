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
      if (navigator.userAgent.indexOf('Firefox') !== -1)
        this.input.css({'padding-left': '5px'});

      // Handle searching.
      this.input.bind('keyup', _.bind(this.search, this));
      this.input.bind('keydown', _.bind(this.searchBlur, this));
      $(document).on('mouseup', _.bind(this.searchBlur, this));

      return List.prototype.setup.call(this);
    },

    searchFocus: function (e) {
      this.input.width(300).attr({placeholder: 'Search posts, members, & crags.'});
      this.active = true;
      var str = this.searchVal();
      if (str !== '' && str.length >= 3 && this.collection.length > 0)
      this.results.show();
    },

    searchBlur: function (e) {
      if (!this.active || ($(e.target).hasClass('header-search')
        && e.keyCode !== 9 && e.which !== 9)) return;
      this.input.width(150).attr({placeholder: 'Search...'});;
      this.results.hide();
      this.active = false;
    },

    searchVal: function () {
      return util.sanitize(this.input.val());
    },

    search: function (e) {

      // Clean search string.
      var str = this.searchVal();
      if (str === '' || str.length < 3) {

        // Hide results display.
        this.results.hide();
        return;
      }
      if (str === this.str) return;
      this.str = str;

      var items = {};
      var types = ['crags', 'members', 'posts'];
      var done = _.after(types.length, _.bind(function () {

        // Render results.
        this._clear();
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
