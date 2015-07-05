/*
 * D3 scatter chart of ticks vs time
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

  var fadeTime = 300;
  var legend_dy = 40;

  var colors = {
    flash: '#b1ec36',
    redpoint: '#009cde',
    onsite: '#e8837b',
    average: '#333'
  };

  // Helper functions
  var getColor = function(tick) {
    if (tick.tries <= 1) { return colors.onsite; }
    else if (tick.tries > 1 && tick.tries <=2) { return colors.flash; }
    else { return colors.redpoint; }
  };


  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {

      this.app = app;
      this.prefs =  this.app.profile.member
          ? this.app.profile.member.prefs: this.app.prefs;
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
      this._updateGraph(d.ticks, d.gradeDomain, d.avgGrade,
          options.immediate);
    },

    renderGraph: function() {

      var self = this;

      // Static graph setup
      this.margin = {top: 60, right: 20, bottom: 80, left: 60};
      this.width = this.$el.width() - this.margin.left - this.margin.right;
      this.height = this.$el.height() - this.margin.top - this.margin.bottom;

      this.x = d3.time.scale()
          .range([0, this.width]);

      this.y = d3.scale.ordinal()
          .rangePoints([this.height, 0]);

      this.xAxis = d3.svg.axis()
          .scale(this.x)
          .orient('bottom');

      this.yAxis = d3.svg.axis()
          .scale(this.y)
          .orient('left')
          .tickSize(-this.width);

      // Create the baseline SVG
      this.svg = d3.select(this.$el.get(0)).append('svg')
          .attr('width', this.width + this.margin.left + this.margin.right)
          .attr('height', this.height + this.margin.top + this.margin.bottom)
          .append('g')
          .attr('transform', 'translate(' + this.margin.left
              + ',' + this.margin.top + ')');

      // Create the X axis
      this.svg.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + this.height + ')')
          .call(this.xAxis);

      // Create the Y axis
      this.svg.append('g')
          .attr('class', 'y axis')
          .call(this.yAxis);

      // Create some data groupings
      this.svg.append('g')
          .attr('class', 'scatterGroup');

      this.svg.append('g')
          .attr('class', 'lineGroup');

      // Create a line generator function
      this.line = d3.svg.line()
          .x(function(d) { return self.x(new Date((d.x + 1).toString())); })
          .y(function(d) { return self.y(d.y); })
          .interpolate('linear')

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

            var style;
            if (d.tries <= 1) { style = 'ONSITE'; }
            else if (d.tries > 1 && d.tries <=2) { style = 'FLASHED'; }
            else { style = 'REDPOINT'; }

            var html = '<strong style="font-size:1.4em">' 
                + d.ascent.name + ', ' + d.crag.name + '</strong></br>'
                + '<strong>a ' + d.grade + ' in ' + d.crag.country+ '</strong></br>'
                + '<strong style="color:' + getColor(d) + '">' + style + ' on '
                + new Date(d.date).format('longDate') + '</strong>';

                return html;
          });

      this.svg.call(this.tip);

    },

    _updateGraph: function(data, gradeDomain, avgGrade, immediate) {

      var self = this;

      // Handle x-axis

      this.x.domain(d3.extent(data, function(d) {
        return new Date(d.date)
      }).map(function(d, idx) {
        var months = 12;
        return d.setDate(d.getDate() + months * 30 * ((idx % 2) === 0 ? -1 : 1));
      }));
      this.svg.selectAll('.x')
          .transition().duration(immediate ? 0 : fadeTime*2).ease("sin-in-out")
          .call(this.xAxis);

      // Handle y-axis

      this.y.domain(gradeDomain);

      // skip first ordinal tick and skip every other if we have more than
      // 6 ticks
      this.yAxis
        .tickValues(gradeDomain.filter(function(d, i) {
          if (i == 0) return false;
          return gradeDomain.length > 6 ? !(i%2) : i;
      }));
      this.svg.selectAll('.y')
          .call(this.yAxis);
      this.svg.selectAll('.y .tick')
          .style('opacity', 0.2);
 
      // Data joins

      var scatterGraph = this.svg.select('.scatterGroup').selectAll('.circle')
          .data(data, function(d) { return d.id; });

      var lineGroup = this.svg.select('.lineGroup')
          .style('opacity', '.8');

      // Showing one point on a line graph is sort of pointless
      if (avgGrade.length <= 1) avgGrade = [];

      var avgTickLine = lineGroup
          .selectAll('.avgGradeLine')
          .data([avgGrade]);

      var avgTickCircle = lineGroup
          .selectAll('.avgGradeCircle')
          .data(avgGrade);

      // Enter

      scatterGraph.enter()
          .append('circle')
          .attr('class', 'circle');

      avgTickLine.enter()
          .append('path')
          .attr('class', 'avgGradeLine')

      avgTickCircle.enter()
          .append('circle')
          .attr('class', 'avgGradeCircle')


      // Update + Enter

      scatterGraph
          .on('mouseenter', this.tip.show)
          .on('mouseleave', this.tip.hide)
          .on('click', function(d) {
            var path = '/efforts/' + d.key;
            self.app.router.navigate(path, {trigger: true});
          });

      scatterGraph
          .attr('cx', function(d) { return self.x(new Date(d.date)); })
          .attr('cy', function(d) { return self.y(d.grade); })
          .attr('r', 8)
          .attr('fill', function(d) { return getColor(d); })
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('opacity', .4);
  
      avgTickLine.attr('d', this.line)
          .style('fill', 'none')
          .style('stroke', colors.average)
          .style('stroke-width', '2px')
          .style('stroke-opacity', 0)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('stroke-opacity', 1);

      avgTickCircle
          .attr('cx', function(d) { return self.x(new Date((d.x + 1).toString())); })
          .attr('cy', function(d) { return self.y(d.y) })
          .attr('r', 4)
          .style('fill', colors.average)
          //.style('stroke', 'lightgrey')
          //.style('stroke-width', '2px')
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : fadeTime)
          .duration(immediate ? 0 : fadeTime)
          .style('opacity', 1);


      // Exit

      scatterGraph
          .exit()
          .transition()
          .duration(fadeTime)
          .style('opacity', 0)
          .remove();

      avgTickCircle
          .exit()
          .transition()
          .duration(fadeTime)
          .style('opacity', 0)
          .remove();

      avgTickLine
          .exit()
          .transition()
          .duration(fadeTime)
          .style('stroke-opacity', 0)
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

      // Group ticks by year
      dataByYear = [];
      _.each(ticksFiltered, function(t) {
        var year = new Date(t.date).getFullYear();
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(t);
      });

      // Get average grade per year and present as {x, y}
      avgGrade = [];
      _.each(dataByYear, function(el, key) {
        var sum = el.reduce(function(prev, cur) {
          return prev + cur.grade;
        }, 0);
        var avg = Math.floor(sum / el.length);
        avg = gradeConverter.indexes(avg, null, system);
        avgGrade.push({x: key, y: avg});
      });

      return {
        ticks: ticksMapped,
        gradeDomain: gradeDomain,
        avgGrade: avgGrade
      };
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
