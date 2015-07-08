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
    maxItems: 8,
    colors: d3.scale.category20(),

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

    // call with tick data and type ('r' or 'b') for routes or boulders
    update: function(data, key, options) {
      options = options || { immediate: false };
      var countedData = this._countData(data, key);
      this._updateGraph(countedData, options.immediate);
    },

    // Create the static graph elements
    renderGraph: function() {

      var self = this;

      // Static graph setup
      this.width = this.$el.width();
      this.height = this.$el.height();
      this.radius = Math.min(this.width, this.height) / 2;

      this.arc = d3.svg.arc()
          .outerRadius(this.radius * 0.8)
          .innerRadius(this.radius * 0.3);

      this.outerArc = d3.svg.arc()
          .innerRadius(this.radius * 0.9)
          .outerRadius(this.radius * 0.9);

      this.pie = d3.layout.pie()
          .sort(null)
          .value(function(d) { return d.count; })

      // Create the baseline SVG
      this.svg = d3.select(this.$el.get(0)).append('svg')
          .attr('width', this.width)
          .attr('height', this.height)
          .append('g')
          .attr("transform", "translate(" + this.width / 2
              + "," + this.height / 2 + ")");

      // Create some data groupings
      this.svg.append('g')
          .attr('class', 'pieArcGroup');

      // Create the tooltip
      this.tip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {

          });

      this.svg.call(this.tip);

    },

    _updateGraph: function(data, immediate) {

      var self = this;
      var total = _.reduce(data, function(memo, d) {
        return memo + d.count;
      }, 0);

      // Data joins

      var pieArcs = this.svg.select('.pieArcGroup').selectAll('.arc')
          .data(this.pie(data))

      // Enter

      var arcGroupEnter = pieArcs.enter()
          .append('g')
          .attr('class', 'arc');

      arcGroupEnter.append('path');

      arcGroupEnter.append('text')
          .attr('class', 'pieLabel')

      arcGroupEnter.append('text')
          .attr('class', 'piePercentage');

      arcGroupEnter.append('polyline')
          .style('opacity', '.3')
          .style('stroke', 'black')
          .style('stroke-width', '2px')
          .style('fill', 'none')

      // Update + Enter

      // Update the downstram data
      pieArcs
          .each(function(d) {
            var d3this = d3.select(this);
            d3this.select('path');
            d3this.select('.pieLabel');
            d3this.select('.piePercentage');
            d3this.select('polyline');
          })

      pieArcs.selectAll('path')
          .style('fill', function(d) { return self.colors(Math.floor(Math.random() * 20)); })
          .transition().duration(self.fadeTime)
          .attrTween("d", function(d) {
            this._current = this._current || d;
            var interpolate = d3.interpolate(this._current, d);
            this._current = interpolate(0);
            return function(t) {
              return self.arc(interpolate(t));
            };
          })

      var midAngle = function(d){
        return d.startAngle + (d.endAngle - d.startAngle)/2;
      }

      pieArcs.selectAll('.pieLabel')
          .attr("transform", function(d) {
            var pos = self.outerArc.centroid(d);
            pos[0] = self.radius * (midAngle(d) < Math.PI ? 1 : -1);
            return "translate(" + pos + ")";
          })
          .attr("dy", ".35em")
          .style('text-anchor', function(d) {
            return midAngle(d) < Math.PI ? "start":"end";
          })
          .text(function(d) { return d.data.name; });

      pieArcs.selectAll('.piePercentage')
          .attr("transform", function(d) {
            var pos = self.arc.centroid(d)
            return "translate(" + pos + ")";
          })
          .attr("dy", ".35em")
          .style('text-anchor', 'middle')
          .text(function(d) {
            var perc = d.value / total * 100;
            return perc >= 2.0 ? Math.floor(perc) + '%' : '';
          });


      pieArcs.selectAll('polyline')
          .attr('points', function(d) {
            var pos = self.outerArc.centroid(d);
            pos[0] = self.radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
            return [self.arc.centroid(d), self.outerArc.centroid(d), pos];
          })

      // Exit

      pieArcs
          .exit()
          .remove()
    },

    _countData: function(data, key) {
      var c = {};
      _.each(data, function(d) {
        if (typeof c[d[key]] === 'undefined') {
          c[d[key]] = 1;
        } else {
          c[d[key]] = c[d[key]] + 1;
        }
      });
      var countedData = [];
      _.each(c, function(val, key) {
        countedData.push({name: key, count: val});
      });
      countedData = _.sortBy(countedData, 'count').reverse();
      if (countedData.length > 8) {
        var others = countedData.slice(8);
        var otherCount = _.reduce(others, function(memo, o) {
          return memo + o.count;
        }, 0);
        countedData = countedData.slice(0,this.maxItems - 1).concat([{
          name: 'Others',
          count: otherCount
        }]);
      }
      return countedData;
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
