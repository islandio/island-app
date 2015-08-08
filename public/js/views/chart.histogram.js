/*
 * D3 simple histogram
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'd3',
  'd3Tip'
], function ($, _, Backbone, mps, rest, util, d3, d3Tip) {

  return Backbone.View.extend({

    colors: [ '#b1ec36', '#009cde', '#e8837b', '#333', '#a33a3a'],

    initialize: function (app, options) {

      this.app = app;
      this.prefs =  this.app.profile.member ?
          this.app.profile.member.prefs: this.app.prefs;
      this.options = options || {};
      this.$el = options.$el;
      this.parentView = options.parentView;
      this.subscriptions = [];

      this.on('rendered', this.setup, this);
    },

    setup: function () {
      return this;
    },

    render: function () {
      this.renderGraph();
      this.trigger('rendered');
      return this;
    },

    events: {

    },


    // Create the static graph elements
    renderGraph: function() {

      if (this.$el.length === 0) return;

      // Static graph setup
      this.margin = {top: 10, right: 20, bottom: 20, left: 20};
      this.width = this.$el.width() - this.margin.left - this.margin.right;
      this.height = this.$el.height() - this.margin.top - this.margin.bottom;

      // Create the baseline SVG
      if (this.svg) {
        this.svg.remove();
      }

      this.svg = d3.select(this.$el.get(0)).append('svg')
          .attr('width', this.$el.width())
          .attr('height', this.$el.height())
          .append("g")
          .attr("transform",
              "translate(" + this.margin.left + "," + this.margin.top + ")");

      // Scales
      this.title = this.svg.append('text')
          .attr('x', 0)
          .attr('y', -20)
          .attr('class', 'd3-title')
          .text(this.options.title || '')
          .style('font-size', 14)
          .style('text-anchor', 'left');

      this.svg.append('g')
          .attr('class', 'histogram-bar-group');

      this.svg.append('g')
          .attr('class', 'histogram-y-axis');

      this.svg.append('g')
          .attr('class', 'histogram-x-axis')
          .attr("transform", "translate(0," + this.height + ")");

      // Create the tooltips
      this.tip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            return '<span>' + d.key + ': ' + d.value + '</span>';
          });

      this.svg.call(this.tip);
    },

    // Expect data as an object with 
    update: function(data, select) {
      var self = this;
      var _data = d3.entries(data);

      // Don't want fat bar graphs, so we pad small bar graph counts
      // differently
      var paddingMap = [0.8, 0.6, 0.4];
      var l = Math.min(_data.length, paddingMap.length);
      var pad = paddingMap[l-1];
      this.x = d3.scale.ordinal().rangeRoundBands([0, this.width], pad, pad);
      this.x.domain(_.pluck(_data, 'key'));

      var dataMax = d3.max(_data, function(d) { return d.value; });
      this.y = d3.scale.linear().range([this.height, 0]);
      this.y.domain([0, dataMax]);

      this.xAxis = d3.svg.axis()
          .scale(this.x)
          .orient('bottom');

      var xAxis = this.svg.selectAll('.histogram-x-axis')
          .transition().duration(200).ease('linear')
          .call(this.xAxis);

      xAxis.selectAll('path')
          .style('display', 'none');

      xAxis.selectAll('line')
          .style('fill', 'none')
          .style('stroke', '#333')
          .style('shape-rendering', 'crispEdges');

      xAxis.selectAll('.tick')
          .style('font-size', 11);

      var barGroup = this.svg.select('.histogram-bar-group');
      var barGraph = barGroup.selectAll('.histogram-bar')
          .data(_data);

      barGraph.enter()
          .append('rect')
          .attr('class', 'histogram-bar');

      barGraph
          .attr('height', function(d) { return self.height - self.y(d.value); })
          .style('fill', function(d) {
            return d.key === select ?  self.colors[4] : self.colors[1];
          })
          .transition().duration(200)
          .attr('y', function(d) { return self.y(d.value); })
          .attr('x', function(d) { return self.x(d.key); })
          .attr('width', self.x.rangeBand());

      barGraph
          .exit()
          .remove();

/*
      barGraph
          .on('mouseenter', self.tip.show)
          .on('mouseleave', self.tip.hide);
*/
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });

      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});
