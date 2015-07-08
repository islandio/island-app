/*
 * D3 bar chart of ticks
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

  // Helper functions
  var getOnsites = function(ticks) {
    return ticks.reduce(function(memo, t) {
      return (t.tries <= 1) ? memo + 1: memo;
    }, 0);
  };

  var getFlashes = function(ticks) {
    return ticks.reduce(function(memo, t) {
      return (t.tries > 1 && t.tries < 3) ? memo + 1: memo;
    }, 0);
  };

  var getRedpoints = function(ticks) {
    return ticks.reduce(function(memo, t) {
      return (t.tries >= 3) ? memo + 1: memo;
    }, 0);
  };

  var fadeTime = 300;
  var legend_dy = 40;

  var colors = {
    flash: '#b1ec36',
    redpoint: '#009cde',
    onsite: '#e8837b'
  };


  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {

      this.app = app;
      this.prefs =  this.app.profile.member ? this.app.profile.member.prefs: this.app.prefs;
      this.options = options || {};
      this.$el = options.$el;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    setup: function () {
      return this;
    },

    render: function (width, height) {
      this.renderGraph();
      this.trigger('rendered');
      return this;
    },

    events: {

    },

    update: function(data, type, options) {
      options = options || { immediate: false };
      var d = this._transposeData(data, type);
      this._updateGraph(d.ticksByGrade, d.gradeDomain,
          options.immediate);
    },

    renderGraph: function() {

      var self = this;

      // Static graph setup
      this.margin = {top: 60, right: 20, bottom: 80, left: 40};
      this.width = this.$el.width() - this.margin.left - this.margin.right;
      this.height = this.$el.height() - this.margin.top - this.margin.bottom;

      this.x = d3.scale.ordinal()
          .rangeRoundBands([0, this.width], 0.25);

      this.y = d3.scale.linear()
          .range([this.height, 0]);

      this.xAxis = d3.svg.axis()
          .scale(this.x)
          .orient('bottom');

      this.yAxis = d3.svg.axis()
          .scale(this.y)
          .orient('left')
          .ticks(3, '')
          .tickSize(-this.width);

      // Create the baseline SVG
      this.svg = d3.select(this.$el.get(0)).append('svg')
          .attr('width', this.width + this.margin.left + this.margin.right)
          .attr('height', this.height + this.margin.top + this.margin.bottom)
          .append('g')
          .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

      // Create the X axis
      this.svg.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + this.height + ')')
          .call(this.xAxis);

      // Create the Y axis
      this.svg.append('g')
          .attr('class', 'y axis')
          .call(this.yAxis);

      // Create the legend
      var legendEntries = this.svg.append('g')
          .attr('class', 'legend')
          .selectAll('legendEntries')
          .data(d3.entries(colors))
          .enter()
          .append('g')
          .attr('class', 'legend-entry');

      legendEntries.append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('y', -9)
          .style('fill', function(d) { return d.value; })
          .style('opacity', 1);

      legendEntries.append('text')
          .text(function(d) { return d.key; })
          .attr('font-size', 12)
          .attr('x', 15);

      // Once legend is rendered move it to right spot
      legendEntries
          .attr('transform', function(d, idx) {
            var lwidth = 100;
            var lpad = 80;
            var entries = legendEntries[0].length;
            var locIdx = idx - (entries/2 - 0.5);
            var locX = (self.width/2) - (lwidth/2) + (locIdx*lpad);
            return 'translate(' + locX + ',' + (self.height + legend_dy) + ')';
          });

      // Create the tooltip
      this.tip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            // Make a line that says '- redpoint
            var makeLine = function(vals, style) {
                var count = 0;
                switch (style) {
                  case 'redpoint': { count = getRedpoints(vals); break; }
                  case 'flash': { count = getFlashes(vals); break; }
                  case 'onsite': {  count = getOnsites(vals); break; }
                }
                if (count === 0) return '';
                var noun = style;
                if (count !== 1) {
                  switch (style) {
                    case 'redpoint': { noun = 'redpoints'; break; }
                    case 'flash': { noun = 'flashes'; break; }
                    case 'onsite': {  noun = 'onsites'; break; }
                  }
                }
                var html =
                '<div style="position:relative;top:1px;width:10px;'
                    + 'height:10px;display:inline-block;'
                    + 'background-color:' + colors[style] + '"></div>'
                + '<span style=color:' + colors[style] + '>&nbsp&nbsp'
                    + count  + ' ' + noun + '</span>'
                + '</br>';
                return html;
            };

            // Sort by date
            var recent = _.sortBy(d.values, 'Date')[0];
            var sends = d.values.length > 1 ? ' SENDS' : ' SEND';
            var html = '<strong style="font-size:1.4em">' + d.key + '</strong></br>'
                + '<strong>' + d.values.length + sends + '</strong>'
                + '</br>'
                + makeLine(d.values, 'onsite')
                + makeLine(d.values, 'flash')
                + makeLine(d.values, 'redpoint')
                + '<span> most recently in </span>'
                + '<strong style="font-size:1.2em">'
                +  new Date(recent.date).getFullYear() + '</strong>';

            return html;
          });

      this.svg.call(this.tip);

    },

    _updateGraph: function(data, xdomain, immediate) {

      var self = this;

      this.x.domain(xdomain);
      this.svg.selectAll('.x')
          .transition().duration(immediate ? 0 : fadeTime*2).ease("sin-in-out")
          .call(this.xAxis);

      this.y.domain([0, Math.max(5, d3.max(data, function(d) {
        return d.values.length;
      }))]);
      this.svg.selectAll('.y')
          .call(this.yAxis);

      // Style lowest y axis diferently
      this.svg.selectAll('.y .tick')
          .style('opacity', 0.2);
      this.svg.select('.y .tick')
          .style('opacity', 1)
          .select('text').remove();

      // Data join
      var barGraph = this.svg.selectAll('.barGroup')
          .data(data, function(d) { return d.key; });

      // Enter
      var barGroupEnter = barGraph
          .enter()
          .append('g')
          .attr('class', 'barGroup');

      barGroupEnter.append('rect')
          .attr('class', 'onsites');

      barGroupEnter.append('rect')
          .attr('class', 'flashes');

      barGroupEnter.append('rect')
          .attr('class', 'redpoints');

      // Update + Enter
      barGraph
          .attr('transform', function(d) { return 'translate(' + self.x(d.key) + ',0)'; })
          // Note: D3 children do not inherit their parents data without
          // an explicit select. This code below achieves this for each group.
          .each(function(d) {
            var d3this = d3.select(this);
            d3this.select('.onsites');
            d3this.select('.redpoints');
            d3this.select('.flashes');
          })
          .on('mouseenter', this.tip.show)
          .on('mouseleave', this.tip.hide);

      barGraph.selectAll('.onsites')
          .attr('width', this.x.rangeBand())
          .attr('y', function(d) { return self.y(getOnsites(d.values)); })
          .attr('height', function(d) {
            return self.height - self.y(getOnsites(d.values));
          })
          .style('opacity', 0)
          .style('fill', colors.onsite)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('opacity', 1);

      barGraph.selectAll('.flashes')
          .attr('width', this.x.rangeBand())
          .attr('y', function(d) {
              return self.y(getFlashes(d.values) + getOnsites(d.values));
           })
          .attr('height', function(d) {
              return self.height - self.y(getFlashes(d.values));
           })
          .style('opacity', 0)
          .style('fill', colors.flash)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('opacity', 1);

      barGraph.selectAll('.redpoints')
          .attr('width', this.x.rangeBand())
          .attr('y', function(d) {
              return self.y(getRedpoints(d.values) + getFlashes(d.values)
                  + getOnsites(d.values));
           })
          .attr('height', function(d) {
              return self.height - self.y(getRedpoints(d.values));
           })
          .style('opacity', 0)
          .style('fill', colors.redpoint)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('opacity', 1);

      // Exit
      barGraph
          .exit()
          .transition()
          .duration(fadeTime)
          .style('opacity', 0)
          .remove();

    },

    _transposeData: function(ticks, type) {

      var gradeConverter = this.app.gradeConverter[type];
      var system = type === 'r' ? this.prefs.grades.route : this.prefs.grades.boulder;

      var ticksFiltered = _.filter(ticks, function(t) { return t && t.grade; });

      // Get range of grades
      var gradeExtent = d3.extent(ticksFiltered, function(t) { return t.grade; });

      // Get grade of each array entry
      var ticksMapped = _.map(ticksFiltered, function(t, idx) {
        t =  _.clone(t);
        t.grade = gradeConverter.indexes(t.grade, null, system);
        return t;
      });

      // Group elements by grade for happy D3ing
      var ticksByGrade = d3.nest()
          .key(function(t) { return t.grade; })
          .entries(ticksMapped);

      // We show lower grades than the climber has completed to give
      // a sense of accomplishment. However, don't go too low or the xaxis
      // gets crowded
      var lowerGrade = Math.max(0, gradeExtent[0] - 4);

      // Get grade domain for this graph
      var gradeDomain = _.chain(d3.range(lowerGrade, gradeExtent[1] + 1))
          .map(function(g) {
            return gradeConverter.indexes(g, null, system);
           })
          .unique()
          .value();

      return {ticksByGrade: ticksByGrade, gradeDomain: gradeDomain };

    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });

      this.watchers.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});
