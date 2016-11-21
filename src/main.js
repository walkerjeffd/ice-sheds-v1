var Vue = require('vue'),
    Promise = require('bluebird'),
    topojson = require('topojson-client');

Vue.component('select-single', require('./components/selectSingle'));
Vue.component('select-multiple',require('./components/selectMultiple'));
Vue.component('ice-map', require('./components/iceMap'));
Vue.component('ice-status', require('./components/iceStatus'));

var IceCrossfilter = require('./iceCrossfilter.js');

var app = window.app = new Vue({
  el: '#app',
  data: {
    options: {
      layer: {
        config: {},
        options: [
          {
            id: 'huc4',
            label: 'HUC4',
            url: 'data/huc4.topojson'
          }, {
            id: 'huc6',
            label: 'HUC6',
            url: 'data/huc6.topojson'
          }, {
            id: 'huc8',
            label: 'HUC8',
            url: 'data/huc8.topojson'
          }, {
            id: 'huc10',
            label: 'HUC10',
            url: 'data/huc10.topojson'
          }
        ]
      },
      variable: {
        config: {},
        options: [
          {
            id: 'elevation',
            label: 'Elevation (m)',
            min: 0,
            max: 1000
          }, {
            id: 'forest',
            label: '% Forest Cover',
            min: 0,
            max: 100
          }
        ]
      },
      filters: {
        config: {
          selectedTextFormat: 'count',
          countSelectedText: '{0} variables selected'
        },
        options: [
          {
            id: 'elevation',
            label: 'Elevation (m)'
          }, {
            id: 'forest',
            label: '% Forest Cover'
          }
        ]
      },
      states: {
        config: {
          actionsBox: true,
          selectedTextFormat: 'count',
          countSelectedText: '{0} states selected'
        },
        options: [
          {id: 'CT', label: 'Connecticut'},
          {id: 'DE', label: 'Delaware'},
          {id: 'DC', label: 'District of Columbia'},
          {id: 'ME', label: 'Maine'},
          {id: 'MD', label: 'Maryland'},
          {id: 'MA', label: 'Massachusetts'},
          {id: 'NH', label: 'New Hampshire'},
          {id: 'NJ', label: 'New Jersey'},
          {id: 'NY', label: 'New York'},
          {id: 'PA', label: 'Pennsylvania'},
          {id: 'RI', label: 'Rhode Island'},
          {id: 'VT', label: 'Vermont'},
          {id: 'VA', label: 'Virginia'}
        ]
      },
      map: {
        view: {
          center: [42.2, -71.1],
          zoom: 6
        },
        basemaps: [
          {
            type: 'bing',
            visible: true,
            options: {
              apiKey: 'AvSDmEuhbTKvL0ui4AlHwQNBVuDI2QBBoeODy1vwOz5sW_kDnBx3UMtUxbjsZ3bN'
            }
          },
          {
            type: 'osm'
          }
        ],
        overlays: [
          {
            label: 'Major Streams',
            layer: 'sheds:flowlines_strahler_3',
            visible: true
          }, {
            label: 'Minor Streams',
            layer: 'sheds:detailed_flowlines',
            minZoom: 10
          }, {
            label: 'NHD Waterbodies',
            layer: 'sheds:waterbodies'
          }, {
            label: 'HUC8 Boundaries',
            layer: 'sheds:wbdhu8'
          }, {
            label: 'HUC12 Boundaries',
            layer: 'sheds:wbdhu12',
            minZoom: 10
          }
        ]
      },
    },
    dataset: {
      url: 'https://s3.amazonaws.com/sheds-ice/dataset-20160322-1.csv',
      columns: {
        area: 'AreaSqKM',
        id: 'featureid'
      },
      variables: [
        {
          id: "elevation",
          label: "Elevation (m)",
          aggregation: true,
          filter: true
        }, {
          id: "forest",
          label: "Forest Cover (%)",
          aggregation: true,
          filter: true
        }
      ]
    },
    state: {
      message: 'Initializing...',
      layer: 'huc8',
      variable: 'elevation',
      filters: [],
      states: ['CT', 'DE', 'DC', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT', 'VA']
    },
    map: {
      aggregationLayer: undefined,
      getColor: function (id) {
        return Math.random()
      }.bind(this)
    },
  },
  mounted: function () {
    var vm = this;
    vm.xf = IceCrossfilter();

    // initialize
    vm.loadDataset(vm.dataset)
      .then(function (data) {
        vm.xf.areaColumn(vm.dataset.columns.area).data(data);
        vm.selectVariable(vm.state.variable);
        vm.selectLayer(vm.state.layer)
        vm.map.getColor = function (id) {
          var value = vm.xf.getAggregationValue(id);
          return vm.map.colorScale(value);
        };
        return true;
      })
      .catch(function (err) {
        console.error(err);
        alert('Unable to initialize');
      });
  },
  methods: {
    loadDataset: function (dataset) {
      console.log('app:loadDataset()', dataset);
      var vm = this;

      vm.setStatus('Loading dataset...');
      return new Promise(function (resolve, reject) {
        d3.csv(dataset.url, function(err, data) {
          if (err) return reject(err);

          data.forEach(function(d) {
            dataset.variables.forEach(function(v) {
              d[v.id] = d[v.id] === "" ? null : +d[v.id];
            });

            d[dataset.columns.area] = +d[dataset.columns.area];

            d.huc10 = d.huc12.substr(0, 10);
            d.huc8 = d.huc12.substr(0, 8);
            d.huc6 = d.huc12.substr(0, 6);
            d.huc4 = d.huc12.substr(0, 4);
          });

          vm.setStatus('Ready!');
          resolve(data);
        });
      });
    },
    selectFilters: function (filters) {
      console.log('app:selectFilters()', filters);
      this.state.filters = filters;
    },
    selectLayer: function (layerId) {
      console.log('app:selectLayer()', layerId);
      var vm = this;

      var layer = vm.options.layer.options.filter(function (d) {
        return d.id === layerId;
      })[0];

      if (!layer) {
        return;
      }

      vm.setStatus('Loading layer...');
      return new Promise(function (resolve, reject) {
        d3.json(layer.url, function(err, data) {
          if (err) return reject(err);

          var geojson = topojson.feature(data, data.objects[layer.id]);

          vm.map.aggregationLayer = geojson;
          vm.updateAggregation(layerId, vm.state.variable);

          vm.setStatus('Ready!');
          return resolve(geojson);
        });
      });
    },
    selectStates: function (states) {
      console.log('app:selectStates()', states);
      this.state.states = states;
    },
    selectVariable: function (id) {
      console.log('app:selectVariable()', id);
      var vm = this;
      var variable = this.options.variable.options.filter(function (d) {
        return d.id == id;
      })[0];

      if (!variable) {
        console.error('Cannot find variable:', id);
        return;
      }

      this.map.colorScale = d3.scale.linear().domain([variable.min, variable.max]).range(['hsl(62,100%,90%)', 'hsl(222,30%,20%)']).clamp(true).interpolate(d3.interpolateHcl);

      this.updateAggregation(this.state.layer, id);
    },
    setStatus: function (message) {
      this.state.message = message;
    },
    updateAggregation: function (layer, variable) {
      console.log('app:updateAggregation()', layer, variable);
      this.state.layer = layer;
      this.state.variable = variable;
      this.xf.setAggregation(this.state.layer, this.state.variable);
    }
  }
})
