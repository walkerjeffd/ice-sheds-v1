var L = require('leaflet');
require('leaflet-bing-layer');

require('../leaflet/controlTransparency');

var nullFill = '#EEE';

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
  props: ['center', 'zoom', 'basemaps', 'overlays', 'layer', 'catchmentLayer', 'getFeatureValue', 'getCatchmentValue', 'colorScale', 'renderTooltip', 'setView', 'variable', 'filters', 'selected'],
  template: '<div class="ice-map"></div>',
  data: function () {
    return {
      data: {}
    }
  },
  computed: {
    catchmentMode: function () {
      return !!this.catchmentLayer;
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
    g.append('g').classed('catchment-fill', true);
    g.append('g').classed('catchment-mouse', true);

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
    layer: function (n, o) {
      console.log('map:watch layer');
      this.data.layer = n;
      this.resizeSvg();
    },
    catchmentLayer: function (n, o) {
      console.log('map:watch catchmentLayer', n);
      this.renderAll();
      this.fitToCatchments(n);
    },
    variable: function (n, o) {
      console.log('map:watch variable', n);
      this.renderAll();
    },
    // getFeatureValue: function (n, o) {
      // console.log('map:watch getFeatureValue');
      // this.renderAll();
    // },
    selected: function (n, o) {
      console.log('map:watch selected', (n ? n.id : 'none'));
      // this.renderAll();
      this.renderSelected();
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
    fitToCatchments: function (catchments) {
      console.log('map:fitToCatchments()', catchments);
      if (!catchments) return;

      var geoJson = L.geoJson(catchments);
      this.leafletMap.fitBounds(geoJson.getBounds());
    },
    resizeSvg: function () {
      if (this.data.layer) {
        var bounds = this.path.bounds(this.data.layer),
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
    renderSelected: function () {
      var vm = this;
      vm.svg.select('g.aggregation-mouse').selectAll('path.ice-map-path-aggregation-mouse')
        .style('stroke', function (d) {
          return vm.selected && vm.selected.id == d.id ? 'red' : null;
        });
    },
    renderCatchment: function () {
      console.log('map:renderCatchment()', this.catchmentLayer);

      var vm = this;
      var features = this.catchmentLayer && this.catchmentLayer.features;
      if (!features) return;

      var gFill = this.svg.select('g.catchment-fill');

      var fillPaths = gFill.selectAll('path.ice-map-path-catchment-fill')
        .data(features);

      fillPaths.enter()
        .append('path')
        .classed('ice-map-path-catchment-fill', true);

      fillPaths
        .attr('d', this.path)
        .style('stroke-width', 0.1)
        .style('fill', function(d, i) {
          var value = vm.getCatchmentValue(d.id);
          return value === null ? nullFill : vm.colorScale(value);
          // var domain = vm.colorScale.domain(),
          //     value = domain[0] + Math.random()*(domain[1] - domain[0]);
          // return vm.colorScale(value);
        });

      fillPaths.exit().remove();
    },
    renderAll: function () {
      console.log('map:renderAll()');
      var vm = this;

      var features = [];
      if (this.data.layer) features = this.data.layer.features;

      // bottom layer that only shows the color of each feature
      var fillPaths = this.svg.select('g.aggregation-fill')
        .selectAll('path.ice-map-path-aggregation-fill')
        .data(features, function (d) { return d.id; });

      fillPaths.enter()
        .append('path')
        .classed('ice-map-path-aggregation-fill', true);

      fillPaths
        .attr('d', this.path);

      fillPaths.exit().remove();

      vm.renderFill();

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
            .html(function () {
              return vm.renderTooltip(d);
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
            vm.$emit('select', d);
          }
        });

      mousePaths
        .attr('d', this.path)
        .style('stroke', function (d) {
          return vm.selected && vm.selected.id == d.id ? 'red' : null;
        });

      mousePaths.exit().remove();

      this.renderCatchment();
    },
    renderFill: function () {
      var vm = this;

      this.svg.select('g.aggregation-fill')
        .selectAll('path.ice-map-path-aggregation-fill')
        .style('fill', function(d, i) {
          var value = vm.getFeatureValue(d.id);
          return value === null ? nullFill : vm.colorScale(value);
        })

      this.svg.select('g.catchment-fill')
        .selectAll('path.ice-map-path-catchment-fill')
        .style('fill', function(d, i) {
          var value = vm.getCatchmentValue(d.id);
          return value === null ? nullFill : vm.colorScale(value);
        });
    }
  }
};
