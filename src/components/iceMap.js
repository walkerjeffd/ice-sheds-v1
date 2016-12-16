var L = require('leaflet');
require('leaflet-bing-layer');

require('../leaflet/controlTransparency');

var basemapGenerators = {
  bing: function (options) {
    return {
      label: 'Bing Satellite',
      layer: L.tileLayer.bing(options.apiKey)
    };
  },
  osm: function (options) {
    return {
      label: 'Open Street Map',
      layer: L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      })
    };
  }
}

module.exports = {
  props: ['center', 'zoom', 'basemaps', 'overlays', 'aggregationLayer', 'getColor', 'setView', 'displayVariable', 'filters', 'selected'],
  template: '<div class="ice-map"></div>',
  data: function () {
    return {
      data: {}
    }
  },
  mounted: function () {
    var vm = this;

    leafletMap = L.map(this.$el, {
      center: this.center,
      zoom: +this.zoom,
      layers: []
    });

    var basemapLayers = {};
    this.basemaps.forEach(function (d) {
      var basemap = basemapGenerators[d.type](d.options);
      basemapLayers[basemap.label] = basemap.layer;
      if (d.visible) basemap.layer.addTo(leafletMap);
    });

    var overlayLayers = {};
    this.overlays.forEach(function (d) {
      var key = '<img src="http://ecosheds.org:8080/geoserver/wms?' +
        'REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png' +
        '&WIDTH=20&HEIGHT=20&LAYER=' + d.layer +
        '&LEGEND_OPTIONS=fontAntiAliasing:true;forceLabels:off"> ' + d.label;

      overlayLayers[key] = L.tileLayer.wms('http://ecosheds.org:8080/geoserver/wms', {
        layers: d.layer,
        format: 'image/png',
        transparent: true,
        opacity: d.opacity || 0.5,
        minZoom: d.minZoom || -Infinity,
        maxZoom: d.maxZoom || Infinity
      });

      if (d.visible) overlayLayers[key].addTo(leafletMap);
    });

    // controls
    L.control.transparency({position: 'topleft'}).addTo(leafletMap);

    L.control.layers(basemapLayers, overlayLayers, {
        position: 'topleft',
        collapsed: true
      }).addTo(leafletMap);

    L.control.scale({position: 'bottomleft'}).addTo(leafletMap);

    // events
    var moveTimeout;
    leafletMap.on('movestart', function () {
      window.clearTimeout(moveTimeout);
      vm.disableClick = true;
    })
    leafletMap.on('moveend', function () {
      vm.setView([leafletMap.getCenter()['lat'], leafletMap.getCenter()['lng']], leafletMap.getZoom());
      moveTimeout = setTimeout(function () {
        vm.disableClick = false;
      }, 100);
    })

    leafletMap.on('zoomend', function () {
      vm.setView([leafletMap.getCenter()['lat'], leafletMap.getCenter()['lng']], leafletMap.getZoom());
      vm.resizeSvg();
    });

    // svg overlay
    this.svg = d3.select(leafletMap.getPanes().overlayPane).append('svg');
    var g = this.svg.append('g').attr('class', 'leaflet-zoom-hide');

    var transform = d3.geo.transform({point: projectPoint});
    this.path = d3.geo.path().projection(transform);

    g.append('g').classed('aggregation-fill', true);
    g.append('g').classed('aggregation-mouse', true);
    g.append('g').classed('catchments', true);

    // tooltip
    this.tooltip = d3.select(this.$el).append('div').attr('class', 'ice-map-tooltip hidden');

    function projectPoint (x, y) {
      var point = leafletMap.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }

    this.$watch('filters', function (n, o) {
      // console.log('map:watch filters', vm.filters);
      this.renderFill();
    }, {deep: true});

    this.leafletMap = leafletMap;
  },
  watch: {
    aggregationLayer: function (n, o) {
      this.data.aggregationLayer = n;
      this.resizeSvg();
    },
    displayVariable: function (n, o) {
      console.log('map:watch displayVariable', n);
      this.renderAll();
    },
    getColor: function (n, o) {
      console.log('map:watch getColor');
      this.renderAll();
    },
    selected: function (n, o) {
      console.log('map:watch selected', (n ? n.id : 'none'));
      this.renderAll();
    },
    center: function (n, o) {
      console.log('map:watch center', n);
      this.updateView(this.center, this.zoom);
    },
    zoom: function (n, o) {
      console.log('map:watch zoom', n);
      this.updateView(this.center, this.zoom);
    }
  },
  methods: {
    updateView: function (center, zoom) {
      if (this.leafletMap.getCenter().lat !== center[0] || this.leafletMap.getCenter().lng !== center[1] || this.leafletMap.getZoom() !== zoom) {
        console.log('map:updateView()', center, zoom);
        this.leafletMap.setView(center, zoom);
      }
    },
    resizeSvg: function () {
      if (this.data.aggregationLayer) {
        var bounds = this.path.bounds(this.data.aggregationLayer),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        this.svg.attr('width', bottomRight[0] - topLeft[0])
          .attr('height', bottomRight[1] - topLeft[1])
          .style('left', topLeft[0] + 'px')
          .style('top', topLeft[1] + 'px');

        this.svg.select('g').attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');
      }
      this.renderAll();
    },
    renderAll: function () {
      console.log('map:renderAll()');
      var vm = this;

      var features = [];
      if (this.data.aggregationLayer) features = this.data.aggregationLayer.features;

      // bottom layer that only shows the color of each feature
      var fillPaths = this.svg.select('g.aggregation-fill')
        .selectAll('path.ice-map-path-aggregation-fill')
        .data(features, function (d) { return d.id; });

      fillPaths.enter()
        .append('path')
        .classed('ice-map-path-aggregation-fill', true);

      fillPaths
        .attr('d', this.path)
        .style('fill', function(d, i) {
          // var value  = resolution === 'catchment' ? null : getHucValue(d, i);
          // return value === null ? naColor : color(value);
          // var value = colorValue(d.id);
          // return value === null ? null : color(value);
          return vm.getColor(d.id);
          // return color(Math.random());
        })

      fillPaths.exit().remove();

      // top layer for mouse interaction
      var mousePaths = this.svg.select('g.aggregation-mouse').selectAll('path.ice-map-path-aggregation-mouse')
          .data(features, function (d) { return d.id; });

      mousePaths.enter()
        .append('path')
        .classed('ice-map-path-aggregation-mouse', true)
        .style('pointer-events', 'visible')
        .style('cursor', 'pointer')
        .on('mousemove', function(d, i) {
          var mouse = d3.mouse(vm.$el).map(function(d) {
            return parseInt(d);
          });

          vm.tooltip
            .classed('hidden', false)
            .attr('style', 'left:' + (mouse[0] + 25) + 'px;top:' + (mouse[1] - 25) + 'px')
            .html(function() {
              var value = "xyz"
              return '<span>' + d.id + ' | ' + d.properties.name + '</span><br><span>' + value + '</span>';
            });
        })
        .on('mouseout', function(d, i) {
          vm.tooltip.classed('hidden', true);
        })
        .on('click', function(d, i) {
          if (vm.disableClick) return;

          if (vm.selected && d.id === vm.selected.id) {
            // this feature is already selected, unselect it
            vm.$emit('select');
          } else {
            // select this feature
            vm.$emit('select', {id: d.id});
          }
        });

      mousePaths
        .attr('d', this.path)
        .style('stroke', function (d) {
          return vm.selected && vm.selected.id == d.id ? 'red' : null;
        });

      mousePaths.exit().remove();
    },
    renderFill: function () {
      // console.log('map:renderFill()');
      var vm = this;

      var fillPaths = this.svg.select('g.aggregation-fill')
        .selectAll('path.ice-map-path-aggregation-fill');

      fillPaths
        .style('fill', function(d, i) {
          return vm.getColor(d.id);
        })
    }
  }
};
