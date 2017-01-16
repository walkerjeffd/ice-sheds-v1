var noop = function (d) { return d; };

// http://www.visualcinnamon.com/2016/05/smooth-color-legend-d3-svg-gradient.html

module.exports = {
  props: ['variable', 'colorScale'],
  template: '<div class="ice-legend" v-show="variable"></div>',
  data: function () {
    return {
      margins: {
        left: 20,
        right: 20
      },
      width: 260
    }
  },
  mounted: function () {
    console.log('legend:mounted');

    var svg = d3.select(this.$el).append('svg')
      .attr('width', this.width + this.margins.left + this.margins.right)
      .attr('height', 40);

    var defs = svg.append('defs');

    var linearGradient = defs.append('linearGradient')
      .attr('id', 'linear-gradient');

    linearGradient
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    svg.append('rect')
      .attr('width', this.width)
      .attr('height', 20)
      .attr('x', this.margins.left)
      .style('fill', 'url(#linear-gradient)');

    svg.append('g')
      .attr('class', 'legend-ticks');
    svg.append('g')
      .attr('class', 'legend-tick-labels');
  },
  watch: {
    variable: function () {
      this.render();
    },
    colorScale: function () {
      this.render();
    }
  },
  computed: {
    formatter: function () {
      if (!this.variable) {
        return noop;
      }

      return d3.format(this.variable.format);
    }
  },
  methods: {
    render: function () {
      console.log('legend:render()');
      var vm = this;

      var svg = d3.select(this.$el).select('svg'),
          linearGradient = svg.select('linearGradient'),
          ticks = svg.select('g.legend-ticks'),
          tickLabels = svg.select('g.legend-tick-labels');

      linearGradient.selectAll('stop').remove();
      ticks.selectAll('rect').remove();
      tickLabels.selectAll('text').remove();

      if (!this.colorScale || !this.colorScale.domain || !this.variable) {
        return;
      }

      var domain = this.colorScale.domain(),
          interval = (this.variable.max - this.variable.min) / 4,
          tickValues = d3.range(this.variable.min, this.variable.max + interval, interval),
          tickScale = d3.scale.linear().domain([this.variable.min, this.variable.max]).range([0, this.width]),
          xScale = d3.scale.linear().domain(domain).range([0, this.width]);

      var offsets = d3.range(0, 1.1, 0.1);

      linearGradient.selectAll('stop')
        .data(offsets)
        .enter()
        .append('stop')
        .attr('offset', function (d) {
          return d;
        })
        .attr('stop-color', function (d) {
          return vm.colorScale(domain[0] + (domain[1] - domain[0]) * d);
        });

      ticks.selectAll('rect')
        .data(tickValues)
        .enter()
        .append('rect')
        .attr('width', 1)
        .attr('height', 5)
        .attr('x', function (d) {
          return vm.margins.left + xScale(d) - 1;
        })
        .attr('y', 20)
        .style('fill', 'gray');

      tickLabels.selectAll('text')
        .data(tickValues)
        .enter()
        .append('text')
        .attr('x', function (d) {
          return vm.margins.left + xScale(d) - 1;
        })
        .attr('y', 25)
        .attr('dy', '1em')
        .attr('font-face', 'arial')
        .attr('font-size', '10')
        .attr('text-anchor', 'middle')
        .text(function (d) { return vm.formatter(d); })
    }
  }
}
