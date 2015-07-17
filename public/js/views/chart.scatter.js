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

  // Helper functions


  return Backbone.View.extend({

    el: '.main',

    fadeTime: 300,
    legend_dy: 40,
    colors: {
      flash: '#b1ec36',
      redpoint: '#009cde',
      onsite: '#e8837b',
      average: '#333'
    },

    initialize: function (app, options) {

      this.app = app;
      this.prefs =  this.app.profile.member
          ? this.app.profile.member.prefs: this.app.prefs;
      this.options = options || {};
      this.$el = options.$el;
      this.subscriptions = [];

      this.mouse = { which: 'right'};

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

    // call with tick data and type ('r' or 'b') for routes or boulders
    update: function(data, type, options) {
      options = options || { immediate: false };
      this.d = this._transposeData(data, type);
      this._resetSliders();
      this._updateGraph(this.d.ticks, this.d.gradeDomain, this.d.timeDomain,
          this.d.avgGrade, options.immediate);
    },

    // Create the static graph elements
    renderGraph: function() {

      var self = this;

      // Static graph setup
      this.margin = {top: 80, right: 60, bottom: 80, left: 60};
      this.width = this.$el.width() - this.margin.left - this.margin.right;
      this.height = this.$el.height() - this.margin.top - this.margin.bottom;

      this.x = d3.time.scale()
          .range([0, this.width]);

      this.y = d3.scale.ordinal()
          .rangePoints([this.height, 0]);

      this.xAxis = d3.svg.axis()
          .scale(this.x)
          .orient('bottom')
          .ticks(6, '')
          .tickSize(-this.height);

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

      this.svg.append('clipPath')
          .attr('id', 'clip')
          .append('rect')
          .attr('x', 10)
          .attr('y', -10)
          .attr('width', this.width - 10)
          .attr('height', this.height + 10)
          .attr('fill', 'blue');

      // Create the X axis
      this.svg.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + this.height + ')')
          .style('stroke-dasharray', ('4, 4'))
          .style('stroke-opacity', .2)
          .call(this.xAxis);

      // Create the Y axis
      this.svg.append('g')
          .attr('class', 'y axis')
          .call(this.yAxis);

      // Create some data groupings
      this.svg.append('g')
          .attr('class', 'scatterGroup')
          .attr('clip-path', 'url(#clip)');

      this.svg.append('g')
          .attr('class', 'lineGroup')
          .attr('clip-path', 'url(#clip)');

      // Slider

      this.slider = this.svg.append('g')
          .attr('class', 'slider')
          .attr('transform', 'translate(0,' + (this.height  + 50) + ')');

      this.slider.on('mousedown', function() {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        var pos = d3.mouse(this);
        var sl = Number(self.sliderLeft.attr('x'));
        var sr = Number(self.sliderRight.attr('x'));
        if (pos[0] > (sr + sl) / 2) {
          var newPos = sr + (self.width/12 * (pos[0] > sr ? 1 : -1));
          self.updateRightSlider(newPos, false);
        } else {
          var newPos = sl + (self.width/12 * (pos[0] > sl ? 1 : -1));
          self.updateLeftSlider(newPos, false);
        }
      });

      this.sliderBar = this.slider.append('rect')
          .attr('class', 'slider-bar')
          .attr('rx', 6)
          .attr('width', this.width)
          .attr('height', 10)
          .style('fill', 'grey')

      this.sliderHighlight = this.slider.append('rect')
          .attr('class', 'slider-highlight')
          .attr('width', this.width)
          .attr('height', this.sliderBar.attr('height'))
          .style('fill', this.colors.redpoint)

      this.sliderLeft = this.slider.append('rect')
          .attr('class', 'slider-left')
          .attr('y', -this.sliderBar.attr('height')/2)
          .attr('width', 10)
          .attr('height', this.sliderBar.attr('height')*2)
          .attr('rx', 2)
          .attr('ry', 2)
          .style('fill', '#333')
          .style('cursor', 'pointer')
          .on('mousedown', function(d) {
            self.startMove('left')
          })

/*
      this.sliderStartDate = this.slider.append('text')
          .attr('x', 5)
          .attr('y', 20)
          .style('text-anchor', 'middle')
          .attr('transform', 'rotate(90)')
          .attr('font-size', '16')

      this.sliderEndDate = this.slider.append('text')
          .attr('x', 5)
          .attr('y', -this.width - 20)
          .style('text-anchor', 'middle')
          .attr('transform', 'rotate(90)')
          .attr('font-size', '16')
*/

/*
      this.sliderLeftText.append('text')
          .attr('class', 'slider-left-text')
          .attr('y', 40)
          .text(new Date(this.x.domain()[0]).format('longDate'))
          .attr('font-size', 12)
*/

      this.sliderRight = this.slider.append('rect')
          .attr('class', 'slider-right')
          .attr('x', this.width-10)
          .attr('y', -this.sliderBar.attr('height')/2)
          .attr('width', 10)
          .attr('height', this.sliderBar.attr('height')*2)
          .attr('rx', 2)
          .attr('ry', 2)
          .style('fill', '#333')
          .style('cursor', 'pointer')
          .on('mousedown', function(d) {
            self.startMove('right')
          })

      d3.select('body')
          .on('mousemove', function() {
            d3.event.preventDefault();
            d3.event.stopPropagation();
            if (self.mouse.moving) {
              if (self.mouse.which === 'right') {
                self.updateRightSlider(d3.mouse(self.sliderRight.node())[0], true);
              } else {
                self.updateLeftSlider(d3.mouse(self.sliderLeft.node())[0], true);
              }
            }
          })
          .on('mouseup', _.bind(self.endMove, self));



      // Create a line generator function
      this.line = d3.svg.line()
          .x(function(d) { return self.x(new Date((d.x + 1).toString())); })
          .y(function(d) { return self.y(d.y); })
          .interpolate('linear')

      // Create the legend
      var legendEntries = this.svg.append('g')
          .attr('class', 'legend')
          .selectAll('legendEntries')
          .data(d3.entries(this.colors))
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
            return 'translate(' + locX + ','
                + (-self.legend_dy) + ')';
          });

      // Create the tooltip
      this.tip = d3Tip()
          .attr('class', 'd3-tip')
          .style('opacity', 0)
          .offset([-20, 0])
          .html(function(d) {
            // Make a line that says '- redpoint

            var style;
            if (d.tries <= 1) { style = 'ONSITE'; }
            else if (d.tries > 1 && d.tries <=2) { style = 'FLASHED'; }
            else { style = 'REDPOINT'; }

            var html = '<strong style="font-size:1.4em">' 
                + d.ascent.name + ', ' + d.crag.name + '</strong></br>'
                + '<strong>a ' + d.grade + ' in ' + d.crag.country+ '</strong></br>'
                + '<strong style="color:' + self.colors[self._getStyle(d)]
                + '">' + style + ' on ' + new Date(d.date).format('longDate')
                + '</strong>';

                return html;
          })

      this.svg.call(this.tip);

    },

    startMove: function(which) {
      d3.event.preventDefault();
      d3.event.stopPropagation();
      this.mouse.moving = true;
      this.mouse.which = which;
      return false;
    },

    endMove: function() {
      d3.event.preventDefault();
      d3.event.stopPropagation();
      this.mouse.moving = false;

      return false;
    },

    recalculateTimeDomain: function(immediate) {
      var extent = this.d.timeDomain[1] - this.d.timeDomain[0]
      var l = Number(this.sliderLeft.attr('x')) / this.width;
      var r = Number(this.sliderRight.attr('x')) / this.width;

      var newDomain = [this.d.timeDomain[0] + extent * l,
          this.d.timeDomain[1] - extent * (1-r)];

      this._updateXDomain(newDomain, immediate);
    },

    updateSliderHighlight: function() {
      this.sliderHighlight.attr('x', this.sliderLeft.attr('x'));
      this.sliderHighlight.attr('width', this.sliderRight.attr('x')
          - this.sliderLeft.attr('x'))
    },

    updateRightSlider: _.debounce(function(newPos, immediate) {
      var xMax = this.width;
      var xMin = Number(this.sliderLeft.attr('x'))
          + Number(this.sliderLeft.attr('width'));
      var x = Math.min(newPos, xMax);
      x = Math.max(x, xMin);
      this.sliderRight.attr('x', x);
      this.updateSliderHighlight();
      this.recalculateTimeDomain(immediate);
    }, 2),

    updateLeftSlider: _.debounce(function(newPos, immediate) {
      var xMin = 0;
      var xMax = Number(this.sliderRight.attr('x'))
          - Number(this.sliderLeft.attr('width'));
      var x = Math.max(newPos, xMin);
      x = Math.min(x, xMax);
      this.sliderLeft.attr('x', x);
      this.updateSliderHighlight();
      this.recalculateTimeDomain(immediate);
    }, 2),

    _resetSliders: function() {
      this.sliderLeft.transition().duration(500).attr('x', 0);
      this.sliderRight.transition().duration(500).attr('x', this.width);
      this.sliderHighlight.transition().duration(500)
          .attr('x', 0).attr('width', this.width);

    },

    _updateXDomain: function(xDomain, immediate) {
      var self = this;

      this.x.domain(xDomain)
      this.svg.selectAll('.x')
          .call(this.xAxis);

      var lineGroup = this.svg.select('.lineGroup');
      var avgTickLine = lineGroup.selectAll('.avgGradeLine');
      var avgTickCircle = lineGroup.selectAll('.avgGradeCircle');
      var scatterGraph = this.svg.select('.scatterGroup').selectAll('.tickCircle');

      scatterGraph
          .transition().duration(immediate ? 0 : 200)
          .attr('cx', function(d) { return self.x(new Date(d.date)); })
      avgTickCircle
          .transition().duration(immediate ? 0 : 200)
          .attr('cx', function(d) { return self.x(new Date((d.x + 1).toString())); })
      avgTickLine
          .transition().duration(immediate ? 0 : 200)
          .attr('d', this.line)

      this.svg.select('.lineGroup')
    },

    _updateGraph: function(data, yDomain, xDomain, avgGrade, immediate) {

      var self = this;

      // Handle x-axis

      this.x.domain(xDomain)
      this.svg.selectAll('.x')
          .transition().duration(immediate ? 0 : this.fadeTime*2).ease('sin-in-out')
          .call(this.xAxis);

      // Handle y-axis

      this.y.domain(yDomain);

      // skip first ordinal tick and skip every other if we have more than
      // 6 ticks
      this.yAxis
        .tickValues(yDomain.filter(function(d, i) {
          if (i == 0) return true;
          if (yDomain.length > 6) {
            return yDomain.length % 2 === 0 ? i%2 : !(i%2);
          } else {
            return i;
          }
      }));
      this.svg.selectAll('.y')
          .call(this.yAxis);
      this.svg.selectAll('.y .tick')
          .style('opacity', 0.2);

      // Update slider

/*
      this.sliderStartDate.text(new Date(this.x.domain()[0]).format('yyyy'))
      this.sliderEndDate.text(new Date(this.x.domain()[1]).format('yyyy'))
*/

      // Slider ticks
      var years = d3.time.year.range(new Date(xDomain[0]), new Date(xDomain[1] + 1));
      this.slider.select('.sliderTicks').remove();
      var sliderTicks = this.slider.append('g').attr('class', 'sliderTicks');
      var sbh = Number(this.sliderBar.attr('height'));
      _.each(years, function (y, idx) {
        if (idx != 0 && idx != years.length-1) {
          sliderTicks.append('line')
              .attr('x1', self.x(y))
              .attr('x2', self.x(y))
              .attr('y1', sbh/2)
              .attr('y2', sbh*1.5)
              .style('stroke', '#333')
        }
        sliderTicks.append('text')
            .text(new Date(y).format('yyyy'))
            .attr('x', self.x(y))
            .attr('y', sbh+15)
            .style('text-anchor', 'middle')
            .style('fill', '#999')
            .style('font-size', 10)
      });

      // Data joins

      var scatterGraph = this.svg.select('.scatterGroup').selectAll('.tickCircle')
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
          .attr('class', 'tickCircle');

      avgTickLine.enter()
          .append('path')
          .attr('class', 'avgGradeLine')

      avgTickCircle.enter()
          .append('circle')
          .attr('class', 'avgGradeCircle')


      // Update + Enter

      scatterGraph
          .on('mouseenter', function(d) {
            d3.select(this)
                .attr('r', 12)
                .style('opacity', 1);
            self.tip.show(d);
          })
          .on('mouseleave', function(d) {
            d3.select(this)
                .attr('r', 8)
                .style('opacity', .4);
            self.tip.hide(d);
          })
          .on('click', function(d) {
            var path = '/efforts/' + d.key;
            self.app.router.navigate(path, {trigger: true});
          });

      scatterGraph
          .attr('cx', function(d) { return self.x(new Date(d.date)); })
          .attr('cy', function(d) { return self.y(d.grade); })
          .attr('r', 8)
          .attr('fill', function(d) { return self.colors[self._getStyle(d)]; })
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : this.fadeTime)
          .duration(immediate ? 0 : this.fadeTime)
          .style('opacity', .4)
          .style('cursor', 'pointer')
  
      avgTickLine.attr('d', this.line)
          .style('fill', 'none')
          .style('stroke', this.colors.average)
          .style('stroke-width', '2px')
          .style('stroke-opacity', 0)
          .transition()
          .delay(immediate ? 0 : this.fadeTime)
          .duration(immediate ? 0 : this.fadeTime)
          .style('stroke-opacity', 1);

      avgTickCircle
          .attr('cx', function(d) { return self.x(new Date((d.x + 1).toString())); })
          .attr('cy', function(d) { return self.y(d.y) })
          .attr('r', 4)
          .style('fill', this.colors.average)
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : this.fadeTime)
          .duration(immediate ? 0 : this.fadeTime)
          .style('opacity', 1);

/*
        setInterval(_.bind(function() {
          this.svg.select('.scatterGroup').selectAll('.tickCircle')
              .transition().duration(1500).ease('linear')
              .attr('cx', function(d) { return self.x(new Date(d.date)) + (Math.random() - .5) * 5; })
              .attr('cy', function(d) { return self.y(d.grade) + (Math.random() - .5) * 5; })
        }, this), 1500)
*/

      // Exit

      scatterGraph
          .exit()
          .transition()
          .duration(this.fadeTime)
          .style('opacity', 0)
          .remove();

      avgTickCircle
          .exit()
          .transition()
          .duration(this.fadeTime)
          .style('opacity', 0)
          .remove();

      avgTickLine
          .exit()
          .transition()
          .duration(this.fadeTime)
          .style('stroke-opacity', 0)
          .remove();


    },

    // Convert incoming tick data to D3 suitable data
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
      var lowerGrade = gradeConverter.indexes(gradeExtent[0], null, system);
      var higherGrade = gradeConverter.indexes(gradeExtent[1], null, system);

      lowerGrade = gradeConverter.offset(lowerGrade, -3, system);
      higherGrade = gradeConverter.offset(higherGrade, 1, system);

      gradeDomain = gradeConverter.range(lowerGrade, higherGrade, system);

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

      avgGrade = _.initial(avgGrade)

      var timeDomain = d3.extent(ticksMapped, function(d) { return d.date; });
      timeDomain[0] = d3.time.year.floor(new Date(timeDomain[0])).valueOf()
      timeDomain[1] = d3.time.year.ceil(new Date(timeDomain[1])).valueOf()

      return {
        ticks: ticksMapped,
        gradeDomain: gradeDomain,
        timeDomain: timeDomain,
        avgGrade: avgGrade
      };
    },

    _getStyle: function(tick) {
      if (tick.tries <= 1) { return 'onsite'; }
      else if (tick.tries > 1 && tick.tries <=2) { return 'flash'; }
      else { return 'redpoint'; }
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });

      d3.select('body')
          .on('mousemove', null)
          .on('mouseup', null);

      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});
