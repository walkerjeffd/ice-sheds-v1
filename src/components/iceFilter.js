module.exports = {
  props: ['id', 'range', 'variable', 'filters', 'selected', 'getDim', 'getSelectedDim'],
  template: '<div class="ice-filter">' +
      '<div class="title">{{variable.label}} <a class="reset" style="display: none;">reset</a><div class="btn btn-default btn-xs pull-right" v-on:click="destroy">×</div></div>' +
      '<div class="stats"><span class="extent">{{rangeLabel}}</span></div>' +
      '<svg></svg>' +
    '</div>',
  mounted: function () {
    console.log('filter(' + this.id + '):mounted');
    var vm = this;

    var margin = {
          top: 10,
          right: 20,
          bottom: 20,
          left: 10
        };

    this.width = 360,
    this.height = 100;

    this.svg = d3.select(this.$el).select("svg")
      .attr("width", this.width + margin.left + margin.right)
      .attr("height", this.height + margin.top + margin.bottom);

    var g = this.svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    g.append("clipPath")
      .attr("id", "clip-" + this.id)
      .append("rect")
      .attr("width", this.width)
      .attr("height", this.height);

    g.selectAll(".all.bar")
      .data(["background", "foreground"])
      .enter()
      .append("path")
      .attr("class", function(d) {
        return d + " all bar";
      });

    g.selectAll(".selected.bar")
      .data(["background", "foreground"])
      .enter()
      .append("path")
      .attr("class", function(d) {
        return d + " selected bar";
      });

    g.selectAll(".foreground.bar")
      .attr("clip-path", "url(#clip-" + this.id + ")");

    this.scales = {
      x: d3.scale.linear().domain([this.variable.min, this.variable.max]).rangeRound([0, this.width]),
      y: d3.scale.linear().range([this.height, 0])
    };
    this.axes = {
      x: d3.svg.axis().orient("bottom").scale(this.scales.x)
    };
    this.brush = d3.svg.brush().x(this.scales.x);

    if (this.range) {
      this.brush.extent(this.range);
    }

    g.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + this.height + ")")
      .call(this.axes.x)

    var gBrush = g.append("g").attr("class", "brush").call(this.brush);
    gBrush.selectAll("rect").attr("height", this.height);
    gBrush.selectAll(".resize").append("path").attr("d", resizePath);

    this.brush.on("brush.chart", function() {
      // console.log('brush.chart', vm.id, vm.brush.extent());
      vm.$emit('brush', vm.id, vm.brush.extent());
      vm.drawBrush();
    });

    this.brush.on("brushend.chart", function() {
      // console.log('brushend.chart', vm.id, vm.brush.extent());
      if (vm.brush.empty()) {
        vm.$emit('brush', vm.id);
      }
      vm.drawBrush();
    });

    this.render();

    function resizePath(d) {
      var e = +(d == "e"),
        x = e ? 1 : -1,
        y = vm.height / 3;
      return "M" + (0.5 * x) + "," + y + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) + "V" + (2 * y - 6) + "A6,6 0 0 " + e + " " + (0.5 * x) + "," + (2 * y) + "Z" + "M" + (2.5 * x) + "," + (y + 8) + "V" + (2 * y - 8) + "M" + (4.5 * x) + "," + (y + 8) + "V" + (2 * y - 8);
    }

    this.$watch('filters', function (n, o) {
      vm.render();
    }, {deep: true});
  },
  computed: {
    rangeLabel: function () {
      var formatter = d3.format(this.variable.format);

      return this.range && this.range.length == 2 ?
        formatter(this.range[0]) + ' - ' + formatter(this.range[1]) :
        formatter(this.variable.min) + ' - ' + formatter(this.variable.max);
    }
  },
  watch: {
    selected: function () {
      // console.log('filter(' + this.id + '):watch selected');
      this.render();
    }
    // range: function () {
      // console.log('filter(' + this.id + '):watch range', this.range);
    // }
  },
  methods: {
    drawBrush: function () {
      if (this.brush.empty()) {
        this.svg.select("#clip-" + this.id + " rect")
          .attr("x", null)
          .attr("width", "100%");
      } else {
        var extent = this.brush.extent();
        this.svg.select("#clip-" + this.id + " rect")
          .attr("x", this.scales.x(extent[0]))
          .attr("width", this.scales.x(extent[1]) - this.scales.x(extent[0]));
      }
    },
    render: function () {
      // console.log('filter(' + this.id + '):render()');
      var vm = this;

      var groups = this.getDim().group.all();
      if (groups[0].key < 0) {
        groups = groups.slice(1, groups.length);
      }

      this.scales.y.domain([0, d3.max(groups, function(d) { return d.value; })]);
      this.svg.selectAll(".all.bar").datum(groups).attr("d", barPath);
      var selectedDim = this.getSelectedDim();
      if (selectedDim) {
        var selectedGroups = selectedDim.group.all();
        if (selectedGroups[0].key < 0) {
          selectedGroups = selectedGroups.slice(1, selectedGroups.length);
        }
        var yMax = d3.max(selectedGroups, function(d) { return d.value; });
        this.scales.y.domain([0, yMax]);
        this.svg.selectAll(".selected.bar").datum(selectedGroups).attr("d", barPath);
      } else {
        this.svg.selectAll(".selected.bar").datum([]).attr("d", barPath);
      }

      this.drawBrush();

      function barPath(groups) {
        var path = [],
          i = -1,
          n = groups.length,
          d;
        while (++i < n) {
          d = groups[i];
          path.push("M", vm.scales.x(d.key), ",", vm.height, "V", vm.scales.y(d.value), "h9V", vm.height);
        }
        return path.join("");
      }
    },
    destroy: function () {
      // console.log('filter(' + this.id + '):destroy()', d3.select(this.$el));
      // this.svg.remove();
      this.$emit('destroy', this.id);
    }
  }
}
