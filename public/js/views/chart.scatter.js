/*
 * D3 scatter chart of ticks vs time
 * SVG is organized into sections with content quadrants.
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

  var sCenter = function(sl) {
    return Number(sl.attr('x')) + Number(sl.attr('width'))/2;
  };

  return Backbone.View.extend({

    el: '.main',

    fadeTime: 300,
    // Width of side panels
    lSideWidth: 200,
    rSideWidth: 125,
    // padding between upper and lower sections
    vertInnerPad: 20,
    scatterOpacity: 0.4,
    colors: {
      flash: '#b1ec36',
      redpoint: '#009cde',
      onsight: '#e8837b',
      average: '#333'
    },
    // width of scatter plot before 'breaking' to a smaller design
    breakWidth: 250,
    // Histgram only
    compact: false,

    initialize: function (app, options) {

      this.app = app;
      this.prefs =  this.app.profile.member ?
          this.app.profile.member.prefs: this.app.prefs;
      this.options = options || {};
      this.$el = options.$el;
      this.parentView = options.parentView;
      this.buttons = options.buttons || ['Boulders', 'Routes'];
      this.subscriptions = [];

      // Store some variables 
      this.store = {};

      // Mouse down events
      this.mouse = { which: 'right'};

      this.on('rendered', this.setup, this);
    },

    setup: function () {

      this.previousWidth = $(window).width();

      return this;
    },

    render: function () {
      this.renderGraph();
      this.trigger('rendered');
      return this;
    },

    events: {

    },

    // call with tick data and type ('r' or 'b') for routes or boulders
    update: function(data, type, options) {
      if (this.$el.length === 0) return;
      options = options || { immediate: false };
      this.d = this._transposeData(data, type);
      this._resetSliders();
      this._resetLegend();
      this._updateGraph(this.d.ticks, this.d.gradeDomain, this.d.timeDomain,
          options.immediate);
    },

    resize: function() {
      if (this.$el.length === 0) return;
      if (this.previousWidth !== $(window).width()) {
        this.renderGraph();
        this._resetLegend();
        this._updateGraph(this.d.ticks, this.d.gradeDomain, this.d.timeDomain,
            { immediate: true} );
        this.setTitle(null, true);
        this.previousWidth = $(window).width();
      }
    },

    // Create the static graph elements
    renderGraph: function() {

      var self = this;

      if (this.$el.length === 0) return;

      // Static graph setup
      this.margin = {top: 55, right: 40, bottom: 20, left: 40};
      this.width = this.$el.width() - this.margin.left - this.margin.right;
      this.height = this.$el.height() - this.margin.top - this.margin.bottom;

      // Create the baseline SVG
      if (this.svg) {
        this.svg.remove();
      }

      this.svg = d3.select(this.$el.get(0)).append('svg');

      this.svg
          .attr('width', this.$el.width())
          .attr('height', this.$el.height());

      // Generate widths and heights for the container classes
      this.lwidth = this.lSideWidth;
      this.rwidth = this.rSideWidth;
      this.mwidth = (this.$el.width() - this.margin.left - this.margin.right) -
          this.lwidth - this.rwidth;

      // responsive stuff
      if (this.mwidth < this.breakWidth || this.compact) {
        this.mwidth = 0;
        this.lwidth = (this.$el.width() - this.margin.left - this.margin.right);
        this.responsive = true;
      } else {
        this.responsive = false;
      }

      this.bheight = 40;
      this.theight = this.$el.height() - this.margin.top - this.margin.bottom -
          this.vertInnerPad - this.bheight;

      // Generate the 4 quadrant container classes
      this.ltSvg = this.svg.append('g')
          .attr('class', 'lt-svg')
          .attr('transform', 'translate(' + this.margin.left + ',' +
              this.margin.top + ')');

      this.mtSvg = this.svg.append('g')
          .attr('class', 'mt-svg')
          .attr('transform', 'translate(' + (this.margin.left + this.lwidth) +
              ',' + this.margin.top + ')');

      this.rtSvg = this.svg.append('g')
          .attr('class', 'rt-svg')
          .attr('transform', 'translate(' + (this.margin.left + this.lwidth +
              this.mwidth) + ',' + this.margin.top + ')');

      var btop = this.margin.top + this.theight + this.vertInnerPad;

      this.mbSvg = this.svg.append('g')
          .attr('class', 'mb-svg')
          .attr('transform', 'translate(' + (this.margin.left + this.lwidth) +
              ',' + btop + ')');

      this.lbSvg = this.svg.append('g')
          .attr('class', 'lb-svg')
          .attr('transform', 'translate(' + (this.margin.left) +
              ',' + btop + ')');

      // Scales

      this.x = d3.time.scale()
          .range([0, this.mwidth]);

      // X2 is thie histograms x axis
      this.x2 = d3.scale.linear()
          .range([0, this.lwidth]);

      this.y = d3.scale.ordinal()
          .rangeRoundBands([this.theight, 0], 0.25);

      this.yAxis = d3.svg.axis()
          .scale(this.y)
          .orient('right');

      this.ltSvg.append('text')
          .attr('x', 0)
          .attr('y', -5)
          .attr('class', 'd3-title')
          .text('Grade Histogram')
          .style('text-anchor', 'left')
          .style("opacity", 0.8);

      this.title = this.mtSvg.append('text')
          .attr('x', this.mwidth/2)
          .attr('y', -5)
          .attr('class', 'd3-title')
          .text(this.store.title || '')
          .style('text-anchor', 'middle');

      // Clip path cuts off rendering of chart if it exceeds bounds
      this.mtSvg.append('clipPath')
          .attr('id', 'clip')
          .append('rect')
          .attr('x', 10)
          .attr('y', 0)
          .attr('width', this.mwidth)
          .attr('height', this.theight);

      this.mtSvg.append('line')
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', 0)
          .attr('y2', this.theight)
          .style('stroke-width', '1px')
          .style('stroke', '#333');

      this.ltSvg.append('g')
          .attr('class', 'grade-bars-group');

      // Create the Y axis
      this.mtSvg.append('g')
          .attr('class', 'grades-y-axis');

      this.mtSvg.append('g')
          .attr('class', 'ticks-scatter-group')
          .attr('clip-path', 'url(#clip)');

      this.mtSvg.append('g')
          .attr('class', 'avg-line-group')
          .attr('clip-path', 'url(#clip)');

      // Slider

      if (this.mwidth !== 0) {
        this.slider = this.mbSvg.append('g')
            .attr('class', 'slider');

        this.slider.on('mousedown', function() {
          d3.event.preventDefault();
          d3.event.stopPropagation();
          var pos = d3.mouse(this);
          var sl = sCenter(self.sliderLeft);
          var sr = sCenter(self.sliderRight);
          var newPos;
          if (pos[0] > (sr + sl) / 2) {
            newPos = sr + (self.mwidth/12 * (pos[0] > sr ? 1 : -1));
            self._updateRightSlider(newPos, false);
          } else {
            newPos = sl + (self.mwidth/12 * (pos[0] > sl ? 1 : -1));
            self._updateLeftSlider(newPos, false);
          }
          mps.publish('chart/state-change', [{timeDomain: self.x.domain()}]);
        });

        this.sliderBar = this.slider.append('rect')
            .attr('class', 'slider-bar')
            .attr('rx', 6)
            .attr('width', this.mwidth)
            .attr('height', 10)
            .style('fill', 'grey');

        this.sliderHighlight = this.slider.append('rect')
            .attr('class', 'slider-highlight')
            .attr('width', this.mwidth)
            .attr('height', this.sliderBar.attr('height'))
            .style('fill', this.colors.redpoint);

        this.sliderLeft = this.slider.append('rect')
            .attr('class', 'slider-left')
            .attr('y', -this.sliderBar.attr('height')/2)
            .attr('x', -5)
            .attr('width', 10)
            .attr('height', this.sliderBar.attr('height')*2)
            .attr('rx', 2)
            .attr('ry', 2)
            .style('fill', '#333')
            .style('cursor', 'pointer')
            .on('mousedown', function() {
              self._startMove('left');
            });

        this.sliderRight = this.slider.append('rect')
            .attr('class', 'slider-right')
            .attr('y', -this.sliderBar.attr('height')/2)
            .attr('x', this.mwidth-5)
            .attr('width', 10)
            .attr('height', this.sliderBar.attr('height')*2)
            .attr('rx', 2)
            .attr('ry', 2)
            .style('fill', '#333')
            .style('cursor', 'pointer')
            .on('mousedown', function() {
              self._startMove('right');
            });

        d3.select('body')
            .on('mousemove', function() {
              d3.event.preventDefault();
              d3.event.stopPropagation();
              if (self.mouse.moving) {
                if (self.mouse.which === 'right') {
                  self._updateRightSlider(
                      d3.mouse(self.sliderRight.node())[0], false);
                } else {
                  self._updateLeftSlider(
                      d3.mouse(self.sliderLeft.node())[0], false);
                }
              }
            })
            .on('mouseup', _.bind(self._endMove, self));
      }


      // Create a line generator function
      this.line = d3.svg.line()
          .x(function(d) { return self.x(new Date((+d.key + 1).toString())); })
          .y(function(d) { return self.y(d.value.avg) + self.y.rangeBand()/2; })
          .interpolate('linear');

      // Create the legend
      var legendEntries = this.rtSvg.append('g')
          .attr('class', 'legend')
          .attr('transform', 'translate(55, 110)')
          .selectAll('legendEntries')
          .data(d3.entries(this.colors))
          .enter()
          .append('g')
          .attr('class', function(d) {
            return 'legend-entry ' + d.key;
          })
          .attr('transform', function(d, idx) {
            return 'translate(' + 0 + ',' + (idx*30) + ')';
          });

      legendEntries.append('circle')
          .attr('r', 8)
          .style('fill', function(d) { return d.value; })
          .style('opacity', 1)
          .style('cursor', function(d) {
            return (d.key !== 'average') ? 'pointer' : 'default';
          })
          .on('click', function(d) {
            if (d.key === 'average') return;
            var _this = d3.select(this);
            legendEntries.selectAll('circle')
                .style('stroke-width', '')
                .style('stroke', '');
            legendEntries.selectAll('text')
                .style('font-weight', '');

            var active = _this.classed('chart-active');
            // Clear previous active
            legendEntries.each(function() {
              d3.select(this).select('circle').classed('chart-active', false);
            });
            self.legendActive = null;

            if (active) {
              _this.classed('chart-active', false);
              mps.publish('chart/state-change', [{tries: null}]);
            } else {
              _this.classed('chart-active', true);
              _this.style('stroke-width', '1px').style('stroke', '#333');
              d3.select(this.parentNode).select('text')
                  .style('font-weight', 'bold');
              self.legendActive = d.key;
              mps.publish('chart/state-change', [{tries: d.key}]);
            }
          })
          .on('mouseenter', function(d) {
            d3.selectAll('.fadeable:not(.' + d.key +')')
                .style('cursor', 'default')
                .transition().duration(500)
                .style('opacity', 0.1);
            d3.selectAll('.tickCircle.' + d.key)
                .transition().duration(500)
                .style('opacity', 0.7);
          })
          .on('mouseleave', function() {
            d3.selectAll('.fadeable')
                .style('cursor', 'pointer')
                .transition().duration(500)
                .style('opacity', 1);
            d3.selectAll('.tickCircle')
                .transition().duration(500)
                .style('opacity', self.scatterOpacity);

            // go back to previous state
            if (self.legendActive) {
              d3.selectAll('.fadeable:not(.' + self.legendActive +')')
                  .style('cursor', 'default')
                  .transition().duration(500)
                  .style('opacity', 0.1);
              d3.selectAll('.tickCircle.' + self.legendActive)
                  .transition().duration(500)
                  .style('opacity', 0.7);
            }
          });

      legendEntries.append('text')
          .text(function(d) { return d.key; })
          .attr('font-size', 12)
          .attr('x', 15)
          .attr('y', 4)
          .style('cursor', 'default');


      // Create some radio buttons. All these do is raise an event on click
      // These could be HTML but fit nicely in the layout of the SVG

      var buttonClick = function(d, donttrigger) {

        var g = d3.select(this);
        if (g.classed('chart-active')) { return; }

        if (!donttrigger) {
          self.parentView.trigger('svgButton', d);
          self.store.buttonId = this.id;
          mps.publish('chart/state-change', [{timeDomain: self.x.domain()}]);
        }

        var t = g.select('text');
        var r = g.select('rect');

        var gNot = d3.selectAll(
            '.svg-buttons .svg-button:not(#' + this.id + ')');
        var tNot = gNot.selectAll('text');
        var rNot = gNot.selectAll('rect');

        // defaults
        rNot.style('fill', '#f2f2f2');
        tNot.style('fill', '#333');
        gNot.classed('chart-active', false);

        r.style('fill', '#333');
        t.style('fill', '#fff');
        g.classed('chart-active', true);
      };

      var buttonEnter = function() {
        var g = d3.select(this);
        var r = g.select('rect');
        if (!g.classed('chart-active')) {
          r.transition().duration(100).ease('linear').style('fill', '#ddd');
        }
      };

      var buttonLeave = function() {
        var g = d3.select(this);
        var r = g.select('rect');
        if (!g.classed('chart-active')) {
          r.transition().duration(100).ease('linear').style('fill', '#f2f2f2');
        }
      };

      var svgButtonParent = this.responsive ? this.lbSvg : this.rtSvg;
      var svgButtonTransform = this.responsive ? '20, -40': '45, 0'

      var radioButtons = svgButtonParent.append('g')
          .attr('class', 'svg-buttons')
          .attr('transform', 'translate(' + svgButtonTransform + ')')
          .selectAll('svg-button')
          .data(this.buttons)
          .enter()
          .append('g')
          .attr('class', 'svg-button')
          .attr('id', function(d, i) { return 'svgButton' + i; })
          .attr('transform', function(d, idx) {
            return 'translate(' + 0 + ',' + (idx*35) + ')';
          })
          .on('click', function(d) { buttonClick.call(this, d); })
          .on('mouseenter', buttonEnter)
          .on('mouseleave', buttonLeave)
          .style('cursor', 'pointer');

      radioButtons
          .append('rect')
          .attr('width', '80')
          .attr('height', '30')
          .attr('rx', '2')
          .attr('ry', '2');

      radioButtons.append('text')
          .text(function(d) { return d; })
          .attr('x', '40')
          .attr('y', '19')
          .attr('text-anchor', 'middle');

      var defaultButtonId =
        this.store.buttonId ? '#' + this.store.buttonId : '.svg-button';
      var ctxt = d3.select(defaultButtonId)[0][0];
      buttonClick.call(ctxt, this.buttons[0], true);

      // Create the tooltips

      this.scatterTip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            var style;
            if (d.tries <= 1) { style = 'ONSITE'; }
            else if (d.tries > 1 && d.tries <=2) { style = 'FLASHED'; }
            else { style = 'REDPOINT'; }

            var html = '<span class="d3-tip-header">' +
                d.ascent.name + ', ' + d.crag.name + '</span>' +
                '<span class="d3-tip-detail">a ' + d.grade + ' in ' +
                d.crag.country + '</span>' +
                '<span style="color:' + self.colors[self._getStyle(d)] +
                '" class="d3-tip-style">' + style + ' on ' +
                new Date(d.date).format('longDate') + '</span>';

            return html;
          });

      var makeLine = function(count, style) {
        if (count === 0) return '';
        var noun = style;
        if (count !== 1) {
          switch (style) {
            case 'redpoint': noun = 'redpoints'; break;
            case 'flash': noun = 'flashes'; break;
            case 'onsight': noun = 'onsights'; break;
          }
        }
        var html =
        '<div style="position:relative;top:1px;width:10px;' +
              'height:10px;display:inline-block;' +
              'background-color:' + self.colors[style] + '"></div>' +
          '<span style=color:' + self.colors[style] + '>&nbsp&nbsp' +
              count  + ' ' + noun + '</span>' +
          '</br>';
        return html;
      };

      this.barTip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            var sends = d.value.total > 1 ? ' SENDS' : ' SEND';
            var html = '<span class="d3-tip-header" style="line-height:16px;">' +
                d.key + '</span>' + '<span class="d3-tip-header">' +
                d.value.total + sends + '</span><span class="d3-tip-style">' +
                makeLine(d.value.onsight, 'onsight') +
                makeLine(d.value.flash, 'flash') +
                makeLine(d.value.redpoint, 'redpoint') + '</span>';

            return html;
          });

      this.avgTickCircleTip = d3Tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            // Sort by date
            var html = '<span class="d3-tip-header">' + d.key +
                ' - ' + (+d.key + 1) + '</span>' +
                '<span class="d3-tip-detail">averaging ' + d.value.avg +
                '</span><span class="d3-tip-style">' +
                makeLine(d.value.onsight, 'onsight') +
                makeLine(d.value.flash, 'flash') +
                makeLine(d.value.redpoint, 'redpoint') + '</span>';
            return html;
          });

      this.ltSvg.call(this.barTip);
      this.mtSvg.call(this.avgTickCircleTip);
      this.mtSvg.call(this.scatterTip);

    },

    _startMove: function(which) {
      d3.event.preventDefault();
      d3.event.stopPropagation();
      this.mouse.moving = true;
      this.mouse.which = which;
      return false;
    },

    _endMove: function() {
      if (this.mouse.moving) {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        this.mouse.moving = false;
        mps.publish('chart/state-change', [{timeDomain: this.x.domain()}]);
        return false;
      }
    },

    _resetLegend: function() {
      this.legendActive = null;
      d3.selectAll('.fadeable')
          .style('cursor', 'pointer')
          .transition().duration(500)
          .style('opacity', 1);
      d3.selectAll('.tickCircle')
          .transition().duration(500)
          .style('opacity', this.scatterOpacity);
      this.rtSvg.selectAll('.legend-entry').selectAll('circle')
          .style('stroke-width', '')
          .style('stroke', '')
          .each(function() {
            d3.select(this).classed('chart-active', false);
          });
      this.rtSvg.selectAll('.legend-entry').selectAll('text')
          .style('font-weight', '');
    },

    // Use slider values to recalculate time domain
    _recalculateTimeDomain: function(immediate) {
      var extent = this.d.timeDomain[1] - this.d.timeDomain[0];
      var l = sCenter(this.sliderLeft) / this.mwidth;
      var r = sCenter(this.sliderRight) / this.mwidth;

      var newDomain = [this.d.timeDomain[0] + extent * l,
          this.d.timeDomain[1] - extent * (1-r)];

      this._updateXDomain(newDomain, immediate);
      var scatterGraph = this.mtSvg.select('.ticks-scatter-group')
          .selectAll('.tickCircle');
      this._updateBarGraph(scatterGraph.data(), newDomain, immediate);
    },


    _updateSliderHighlight: function() {
      this.sliderHighlight.attr('x', sCenter(this.sliderLeft));
      this.sliderHighlight.attr('width', sCenter(this.sliderRight) -
          sCenter(this.sliderLeft));
    },

    _updateRightSlider: _.debounce(function(newPos, immediate) {
      var xMax = this.mwidth - Number(this.sliderRight.attr('width'))/2;
      var xMin = Number(this.sliderLeft.attr('x')) +
          Number(this.sliderLeft.attr('width'));
      var x = Math.min(newPos, xMax);
      x = Math.max(x, xMin);
      this.sliderRight.attr('x', x);
      this._updateSliderHighlight();
      this._recalculateTimeDomain(immediate);
    }, 2),

    _updateLeftSlider: _.debounce(function(newPos, immediate) {
      var xMin = -Number(this.sliderLeft.attr('width'))/2;
      var xMax = Number(this.sliderRight.attr('x')) -
          Number(this.sliderLeft.attr('width'));
      var x = Math.max(newPos, xMin);
      x = Math.min(x, xMax);
      this.sliderLeft.attr('x', x);
      this._updateSliderHighlight();
      this._recalculateTimeDomain(immediate);
    }, 2),

    _resetSliders: function() {
      if (this.mwidth !== 0) {
        this.sliderLeft.transition().duration(500)
            .attr('x', -Number(this.sliderLeft.attr('width'))/2);
        this.sliderRight.transition().duration(500)
            .attr('x', this.mwidth - Number(this.sliderRight.attr('width'))/2);
        this.sliderHighlight.transition().duration(500)
            .attr('x', 0).attr('width', this.mwidth);
      }

    },

    _updateAvgTickData: function(data, domain) {
      var dataByYear = {};
      _.each(data, function(t) {
        var year = new Date(t.date).getFullYear();
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(t);
      });

      _.each(dataByYear, function(val, key) {
        var sums = _.reduce(val, function(m, v) {
          var next = {};
          next.avg = m.avg + domain.indexOf(v.grade);
          next.redpoint = m.redpoint +
              (_.isUndefined(v.tries) || v.tries >= 3);
          next.flash = m.flash +(v.tries > 1 && v.tries < 3);
          next.onsight = m.onsight +(v.tries <= 1);
          return next;
        }, {avg: 0, redpoint: 0, flash: 0, onsight: 0});
        var avg = Math.floor(sums.avg / val.length);
        avg = domain[avg];
        sums.avg = avg;
        dataByYear[key] = sums;
        sums.total = sums.redpoint + sums.flash + sums.onsight;
      });

      var atd = d3.entries(dataByYear);
      return _.initial(_.sortBy(atd, 'key'));
    },

    _updateBarGraphData: function(data, filter) {

      var bgd = _.chain(data)
          .filter(filter ? filter : function() { return true; })
          .groupBy('grade')
          .value();

      _.each(bgd, function(v, k) {
        bgd[k] = {
          flash: _.reduce(v, function(m, val) {
            return +(val.tries > 1 && val.tries < 3) + m;
          }, 0),
          redpoint: _.reduce(v, function(m, val) {
            return +(_.isUndefined(val.tries) || val.tries >= 3) + m;
          }, 0),
          onsight: _.reduce(v, function(m, val) {
            return +(val.tries <= 1) + m;
          }, 0),
          total: v.length
        };
      });
      bgd = d3.entries(bgd);

      return bgd;

    },

    _updateBarGraph: function(data, xDomain, immediate) {
      var self = this;
      var filt = function(d) {
        var d_ = new Date(d.date).valueOf();
        return (d_ >= xDomain[0] && d_ <= xDomain[1]);
      };
      var bgd = this._updateBarGraphData(data, filt);

      var barGroup = this.ltSvg.select('.grade-bars-group');

      var barGraph = barGroup.selectAll('.grade-bars')
          .data(bgd, function(d) { return d.key; });

      var barGroupEnter = barGraph
          .enter()
          .append('g')
          .attr('class', 'grade-bars')
          .style('cursor', 'pointer');

      barGroupEnter.append('rect')
          .attr('class', 'onsight-bar onsight')
          .attr('x', this.lwidth)
          .attr('width', 0);
      barGroupEnter.append('rect')
          .attr('class', 'flash-bar flash')
          .attr('x', this.lwidth)
          .attr('width', 0);
      barGroupEnter.append('rect')
          .attr('class', 'redpoint-bar redpoint')
          .attr('x', this.lwidth)
          .attr('width', 0);

      barGraph
          .attr('transform', function(d) {
            return 'translate(0,' + self.y(d.key) + ')';
          })
          // Note: D3 children do not inherit their parents data without
          // an explicit select. This code below achieves this for each group.
          .each(function() {
            var d3this = d3.select(this);
            d3this.select('.onsight-bar');
            d3this.select('.redpoint-bar');
            d3this.select('.flash-bar');
          });

      barGraph.selectAll('.onsight-bar')
          .attr('height', this.y.rangeBand())
          .style('fill', this.colors.onsight)
          .transition()
          .duration(immediate ? 0 : this.fadeTime*2)
          .attr('x', function(d) {
            return self.lwidth - self.x2(d.value.onsight);
          })
          .attr('width', function(d) { return self.x2(d.value.onsight); });

      barGraph.selectAll('.flash-bar')
          .attr('height', this.y.rangeBand())
          .style('fill', this.colors.flash)
          .transition()
          .duration(immediate ? 0 : this.fadeTime*2)
          .attr('x', function(d) {
              return self.lwidth - self.x2(d.value.onsight + d.value.flash);
           })
          .attr('width', function(d) { return self.x2(d.value.flash); });

      barGraph.selectAll('.redpoint-bar')
          .attr('height', this.y.rangeBand())
          .style('fill', this.colors.redpoint)
          .transition()
          .duration(immediate ? 0 : this.fadeTime*2)
          .attr('x', function(d) {
              return self.lwidth - self.x2(d.value.redpoint +
                  d.value.flash + d.value.onsight);
           })
          .attr('width', function(d) { return self.x2(d.value.redpoint); });

      barGraph
          .exit()
          .remove();


      if (this.barHighlight) {
        d3.select(this.barHighlight).selectAll('rect').style('fill', '#721d1d');
      } else {
        this.barHighlight = null;
      }

      barGraph
          .on('mouseenter', function(d, i) {
            self.barTip.show(d, i);
            if (self.barHighlight !== this) {
              d3.select(this).selectAll('rect')
                  .transition().duration(250).style('fill', '#a33a3a');
            }
          })
          .on('mouseleave', function(d, i) {
            self.barTip.hide(d, i);
            if (self.barHighlight !== this) {
              d3.select(this).selectAll('rect').each(function() {
                var _this = d3.select(this);
                _this.transition().duration(250).style('fill', function() {
                  var classType = _this.attr('class').split(' ')[1];
                  return classType ? self.colors[classType] : 'none';
                });
              });
            }
          })
          .on('click', function(d) {

             // reset
             d3.select(self.barHighlight).selectAll('rect').each(function() {
                var _this = d3.select(this);
                _this.transition().style('fill', function() {
                  var classType = _this.attr('class').split(' ')[1];
                  return classType ? self.colors[classType] : 'none';
                });
              });

            if (self.barHighlight !== this) {
              mps.publish('chart/state-change', [{grade: d.key}]);
              d3.select(this).selectAll('rect').style('fill', '#721d1d');
              self.barHighlight = this;
            }
            else {
              mps.publish('chart/state-change', [{grade: null}]);
              d3.select(this).selectAll('rect').style('fill', '#a33a3a');
              self.barHighlight = null;
            }
          });

      barGroup.select('.bar-counter').remove();
      var barCount = barGroup.append('g').attr('class', 'bar-counter');

      var barY;
      var count = -1;
      var leftX = Number.MAX_VALUE;
      d3.selectAll('.grade-bars').each(function(d) {
        var x = self.lwidth -
            self.x2(d.value.redpoint + d.value.flash + d.value.onsight);
        if (x <= leftX) {
          leftX = Number(x);
          count = d.value.total;
          // get y value in group transform
          barY = Number(d3.select(this)
              .attr('transform').split(',')[1].slice(0,-1));
        }
      });

      if (count !== -1) {
        barCount
            .append('circle')
            .attr('cx', leftX)
            .attr('cy', barY + this.y.rangeBand()/2)
            .attr('r', 3)
            .style('fill', '#333')
            .style('opacity', 0)
            .transition().delay(immediate ? 0: this.fadeTime*2)
            .style('opacity', 1);

        barCount
            .append('line')
            .attr('x1', leftX)
            .attr('x2', leftX)
            .attr('y1', barY + this.y.rangeBand()/2)
            .attr('y2', barY + this.y.rangeBand()/2)
            .style('stroke', 'black')
            .style('fill', 'none')
            .style('stroke-width', 1)
            .style('stroke-dasharray', ('4, 4'))
            .style('stroke-opacity', 0)
            .transition()
            .ease('linear')
            .delay(immediate ? 0: this.fadeTime*2)
            .duration(immediate ? 0 : 300)
            .ease('linear')
            .style('stroke-opacity', 1)
            .attr('y2', barY + this.y.rangeBand()/2 - 52);

        barCount
            .append('text')
            .attr('x', leftX)
            .attr('y', barY + this.y.rangeBand()/2 - 52 - 7)
            .style('text-anchor', 'middle')
            .style('opacity', 0)
            .style('fill', '#333')
            .transition()
            .ease('linear')
            .delay(immediate ? 0: (this.fadeTime*2 + 400))
            .duration(immediate ? 0 : 250)
            .style('opacity', 1)
            .text(count);
        }
    },

    // pass data or the function will grab it from the scatter plot
    _updateXDomain: function(xDomain, immediate) {
      var self = this;

      this.x.domain(xDomain);

      var lineGroup = this.mtSvg.select('.avg-line-group');
      var avgTickLine = lineGroup.selectAll('.avg-tick-line');
      var avgTickCircle = lineGroup.selectAll('.avg-tick-circle');
      var scatterGraph = this.mtSvg.select('.ticks-scatter-group')
          .selectAll('.tickCircle');

      scatterGraph
          .transition().duration(immediate ? 0 : 200)
          .attr('cx', function(d) { return self.x(new Date(d.date)); });
      avgTickCircle
          .transition().duration(immediate ? 0 : 200)
          .attr('cx', function(d) {
              return self.x(new Date((+d.key + 1).toString()));
          });
      avgTickLine
          .transition().duration(immediate ? 0 : 200)
          .attr('d', this.line);

    },

    _updateGraph: function(data, yDomain, xDomain, immediate) {

      var self = this;

      // Set axis domains
      this.y.domain(yDomain);
      this.x.domain(xDomain);

      // Create some data for graphing
      var bgd = this._updateBarGraphData(data);
      var atd = this._updateAvgTickData(data, yDomain);

      this.x2.domain([0, d3.max(bgd, function(d) { return d.value.total; })]);

      // Create y-axis

      var axis = this.mtSvg.selectAll('.grades-y-axis')
          .transition()
          .duration(immediate ? 0 : this.fadeTime*2).ease('linear')
          .call(this.yAxis);

      axis.selectAll('path')
          .style('display', 'none');

      axis.selectAll('line')
          .style('fill', 'none')
          .style('stroke', '#333')
          .style('shape-rendering', 'crispEdges');

      axis.selectAll('.tick')
          .style('font-size', 11);

      // Slider ticks
      var years = d3.time.year.range(
          new Date(xDomain[0]), new Date(xDomain[1] + 1));
      if (this.mwidth !== 0) {
        this.slider.select('.sliderTicks').remove();
        var sliderTicks = this.slider.append('g').attr('class', 'sliderTicks');
        var sbh = Number(this.sliderBar.attr('height'));
        _.each(years, function (y, idx) {
          if (idx !== 0 && idx !== years.length-1) {
            sliderTicks.append('line')
                .attr('x1', self.x(y))
                .attr('x2', self.x(y))
                .attr('y1', sbh/2)
                .attr('y2', sbh*1.5)
                .style('stroke', '#333')
                .style('stroke-opacity', 0)
                .transition()
                .delay(immediate ? 0 : self.fadeTime)
                .duration(immediate ? 0 : self.fadeTime)
                .style('stroke-opacity', 1);
          }
          sliderTicks.append('text')
              .text(new Date(y).format('yyyy'))
              .attr('x', self.x(y))
              .attr('y', sbh+15)
              .style('text-anchor', 'middle')
              .style('fill', '#999')
              .style('font-size', 10)
              .style('opacity', 0)
              .transition()
              .delay(immediate ? 0 : self.fadeTime)
              .duration(immediate ? 0 : self.fadeTime)
              .style('opacity', 1);
        });
      }


      // Build bar graph
      this._updateBarGraph(data, xDomain, immediate);

      // Data joins

      var scatterGraph = this.mtSvg.select('.ticks-scatter-group')
          .selectAll('.tickCircle')
          .data(data, function(d) { return d.id; });

      var lineGroup = this.mtSvg.select('.avg-line-group')
          .style('opacity', '.8');

      // Showing one point on a line graph is sort of pointless
      if (atd.length <= 1) atd = [];

      var avgTickLine = lineGroup
          .selectAll('.avg-tick-line')
          .data([atd]); // note single array makes only one line element

      var avgTickCircle = lineGroup
          .selectAll('.avg-tick-circle')
          .data(atd);

      // Enter

      scatterGraph.enter()
          .append('circle');

      avgTickLine.enter()
          .append('path')
          .attr('class', 'avg-tick-line average fadeable');

      avgTickCircle.enter()
          .append('circle')
          .attr('class', 'avg-tick-circle average fadeable');

      // Update + Enter

      scatterGraph
          .attr('cx', function(d) { return self.x(new Date(d.date)); })
          .attr('cy', function(d) {
              return self.y(d.grade) + self.y.rangeBand()/2;
          })
          .attr('r', 8)
          .attr('class', function(d) {
              return 'tickCircle fadeable ' + self._getStyle(d);
          })
          .attr('fill', function(d) { return self.colors[self._getStyle(d)]; })
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : this.fadeTime)
          .duration(immediate ? 0 : this.fadeTime)
          .style('opacity', self.scatterOpacity);

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
          .attr('cx', function(d) {
            return self.x(new Date((+d.key + 1).toString()));
          })
          .attr('cy', function(d) {
            return self.y(d.value.avg) + self.y.rangeBand()/2;
           })
          .attr('r', 6)
          .style('fill', this.colors.average)
          .style('opacity', 0)
          .transition()
          .delay(immediate ? 0 : this.fadeTime)
          .duration(immediate ? 0 : this.fadeTime)
          .style('opacity', 1);

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

      // Events

      scatterGraph
          .on('mouseenter', function(d) {
            var _this = d3.select(this);
            if (!self.legendActive || _this.classed(self.legendActive)) {
              _this.attr('r', 12).style('opacity', 1);
              self.scatterTip.show(d);
            }
          })
          .on('mouseleave', function(d) {
            var _this = d3.select(this);
            if (!self.legendActive || _this.classed(self.legendActive)) {
              _this.attr('r', 8).style('opacity', 0.4);
              self.scatterTip.hide(d);
            }
          })
          .on('click', function(d) {
            var _this = d3.select(this);
            if (!self.legendActive || _this.classed(self.legendActive)) {
              var path = '/efforts/' + d.key;
              self.scatterTip.hide(d);
              self.app.router.navigate(path, {trigger: true});
            }
          });

      avgTickCircle
          .on('mouseenter', function(d) {
            var _this = d3.select(this);
            if (!self.legendActive || _this.classed(self.legendActive)) {
              _this.attr('r', 9);
              self.avgTickCircleTip.show(d);
            }
          })
          .on('mouseleave', function(d) {
            var _this = d3.select(this);
            if (!self.legendActive || _this.classed(self.legendActive)) {
              _this.attr('r', 6);
              self.avgTickCircleTip.hide(d);
            }
          });


    },

    // Convert incoming tick data to D3 suitable data

    _transposeData: function(ticks, type) {

      var gradeConverter = this.app.gradeConverter[type];
      var system =
          type === 'r' ? this.prefs.grades.route : this.prefs.grades.boulder;

      var ticksFiltered = _.filter(ticks, function(t) {
        return t && t.grade;
      });

      // Get range of grades
      var gradeExtent = d3.extent(ticksFiltered, function(t) {
        return t.grade;
      });

      if (!gradeExtent[0]) {
        gradeExtent[0] = 8;
        gradeExtent[1] = 12;
      }

      // We show lower grades than the climber has completed to give
      // a sense of accomplishment. However, don't go too low or the xaxis
      // gets crowded
      var lowerGrade = gradeConverter.convert(gradeExtent[0], null, system);
      var higherGrade = gradeConverter.convert(gradeExtent[1], null, system);

      lowerGrade = gradeConverter.offset(lowerGrade, -3, system);
      higherGrade = gradeConverter.offset(higherGrade, 1, system);

      var gradeDomain = gradeConverter.range(lowerGrade, higherGrade, system);

      // Get grade of each array entry
      var ticksMapped = _.map(ticksFiltered, function(t) {
        t =  _.clone(t);
        if (t.grade) {
          t.grade = gradeConverter.convert(t.grade, null, system);
        }
        return t;
      });

      // Group ticks by year
      var dataByYear = [];
      _.each(ticksFiltered, function(t) {
        var year = new Date(t.date).getFullYear();
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(t);
      });

      var timeDomain = d3.extent(ticksMapped, function(d) { return d.date; });

      if (!timeDomain[0]) {
        timeDomain[0] = new Date('1/1/2015');
        timeDomain[1] = new Date();
      }

      timeDomain[0] = d3.time.year.floor(new Date(timeDomain[0])).valueOf();
      timeDomain[1] = d3.time.year.ceil(new Date(timeDomain[1])).valueOf();

      return {
        ticks: ticksMapped,
        gradeDomain: gradeDomain,
        timeDomain: timeDomain
      };
    },

    _getStyle: function(tick) {
      if (tick.tries <= 1) { return 'onsight'; }
      else if (tick.tries > 1 && tick.tries <=2) { return 'flash'; }
      else { return 'redpoint'; }
    },

    setTitle: function(t, immediate) {

      if (this.$el.length === 0) return;

      // load state
      if (!t) {
        t = this.store.title || '';
      } else {
        this.store.title = t;
      }

      if (this.mwidth === 0) {
        this.title.text('');
        return;
      }
      var time = immediate ? 0 : 100;
      this.title.transition().duration(time).style('opacity', 0);
      this.title.transition().delay(time).text(t);
      this.title.transition().duration(time).delay(time).style('opacity', 0.8);
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
