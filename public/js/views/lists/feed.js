/*
 * Feed List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/feed.html',
  'collections/feed',
  'views/rows/card'
], function ($, _, List, mps, template, Collection, Row) {

  var NUM_GRID = 50;
  var NUM_FLOW = 25;
  var COL_WIDTH = 385;
  var COL_GAP_X = 30;
  var COL_GAP_Y = 30;
  var MIN_COLS = 1;
  var MAX_COLS = 2;
  var x_off = 0;
  var y_off = 0;
  var col_heights = [];

  return List.extend({
    
    el: '#feed',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection({ reverse: true });
      this.Row = Row;

      // Shell subscriptions:
      this.subscriptions = [
        mps.subscribe('idea/new', _.bind(this.collect, this)),
        mps.subscribe('campaign/new', _.bind(this.collect, this)),
      ];

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Reset the collection with the appropriate list.
      this.collection.reset(this.app.profile.get('page').ideas.items);
    },

    collect: function (topic, data) {
      this.collection.unshift(data);
    },

    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.length > 0) {
        this.$el.show();
        this.collage();
      }
      return this;
    },

    renderLast: function () {
      List.prototype.renderLast.call(this);
      this.collage();
      return this;
    },

    collage: function () {
      // determine the number of columns
      function num_cols(wrap) {
        return Math.min(Math.max(MIN_COLS, (parseInt(wrap.innerWidth())
                        + COL_GAP_X) / (COL_WIDTH + COL_GAP_X)), MAX_COLS);
      }
      // calc num cols once
      var nc = num_cols(this.$el);
      // clear column height array
      for (var x = 0; x < nc; x++) 
        col_heights[x] = 0;
      // loop over each object in grid
      this.$('.card').each(function (i) {
        var self = $(this);
        var obj_col = 0;
        var obj_y = 0;
        // determine how many columns the object will span
        var obj_span = Math.max(Math.round(self.outerWidth() / COL_WIDTH), 1);
        // determine which column to place the object in
        for (var x = 0; x < nc - (obj_span - 1); x++)
          obj_col = col_heights[x] < col_heights[obj_col] ? x : obj_col;
        // determine the object's y position
        for (x = 0; x < obj_span; x++) 
          obj_y = Math.max(obj_y, col_heights[obj_col + x]);
        // determine the new height for the effected columns
        for (x = 0; x < obj_span; x++) 
          col_heights[obj_col + x] = parseInt(self.outerHeight()) + COL_GAP_Y + obj_y;
        // set the object's css position
        self.css('left', obj_col * (COL_WIDTH + COL_GAP_X) + x_off).css('top', obj_y + y_off).show();
      });

      // get max column height
      var gridHeight = Math.max.apply(null, col_heights);
      // add some extra space below the grid
      this.$el.height(gridHeight + 0);
    },

  });
});
