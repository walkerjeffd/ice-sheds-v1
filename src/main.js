var Vue = require('vue'),
    Promise = require('bluebird'),
    topojson = require('topojson-client');

Vue.component('select-picker', require('./components/selectPicker'));
Vue.component('ice-map', require('./components/iceMap'));
Vue.component('ice-status', require('./components/iceStatus'));

var IceCrossfilter = require('./iceCrossfilter.js');

var app = window.app = new Vue({
  el: '#app',
  data: {
    options: {
      layer: {
        config: {},
        options: []
      },
      variable: {
        config: {},
        options: []
      },
      filters: {
        config: {
          selectedTextFormat: 'count',
          countSelectedText: '{0} variables selected'
        },
        options: []
      },
      states: {
        config: {
          actionsBox: true,
          selectedTextFormat: 'count',
          countSelectedText: '{0} states selected'
        },
        options: []
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
      layers: [
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
      ],
      states: [
        { id: 'CT', label: 'Connecticut' },
        { id: 'DE', label: 'Delaware' },
        { id: 'DC', label: 'District of Columbia' },
        { id: 'ME', label: 'Maine' },
        { id: 'MD', label: 'Maryland' },
        { id: 'MA', label: 'Massachusetts' },
        { id: 'NH', label: 'New Hampshire' },
        { id: 'NJ', label: 'New Jersey' },
        { id: 'NY', label: 'New York' },
        { id: 'PA', label: 'Pennsylvania' },
        { id: 'RI', label: 'Rhode Island' },
        { id: 'VT', label: 'Vermont' },
        { id: 'VA', label: 'Virginia' },
        { id: 'WV', label: 'West Virginia' }
      ],
      variables: [
        {
          id: "elevation",
          label: "Elevation (m)",
          aggregation: true,
          filter: true,
          min: 0,
          max: 1000
        }, {
          id: "forest",
          label: "Forest Cover (%)",
          aggregation: true,
          filter: true,
          min: 0,
          max: 100
        }
      ]
    },
    state: {
      message: 'Initializing...',
      layer: 'huc8',
      variable: 'forest',
      filters: [],
      states: ['CT', 'DE', 'DC', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT', 'VA', 'WV'],
      xf: {
        filters: {
        }
      },
      map: {
        aggregationLayer: undefined,
        getColor: function (id) {
          return Math.random()
        }.bind(this)
      }
    },
  },
  mounted: function () {
    var vm = this;
    vm.xf = IceCrossfilter();

    // set up select options
    vm.options.layer.options = vm.dataset.layers.map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });
    vm.options.variable.options = vm.dataset.variables.filter(function (d) {
        return d.aggregation;
      }).map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });
    vm.options.states.options = vm.dataset.states.map(function (d) {
      return {
        id: d.id,
        label: d.label
      };
    });
    vm.options.filters.options = vm.dataset.variables.filter(function (d) {
        return d.filter;
      }).map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });

    // initialize
    vm.fetchDataset(vm.dataset)
      .then(function (data) {
        vm.xf.areaColumn(vm.dataset.columns.area).data(data);
        vm.xf.addDim('stusps');
        vm.selectVariable(vm.state.variable);
        vm.selectLayer(vm.state.layer);
        vm.selectStates(vm.state.states);
        vm.state.map.getColor = function (id) {
          var value = vm.xf.getAggregationValue(id);
          return vm.state.map.colorScale(value);
        };
        return true;
      })
      .catch(function (err) {
        console.error(err);
        alert('Unable to initialize');
      });
  },
  methods: {
    fetchDataset: function (dataset) {
      console.log('app:fetchDataset()', dataset);
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
    selectLayer: function (id) {
      console.log('app:selectLayer()', id);
      var vm = this;

      var layer = vm.dataset.layers.filter(function (d) {
        return d.id === id;
      })[0];

      if (!layer) {
        console.error('Unable to get layer', id);
        return;
      }

      vm.setStatus('Loading layer...');
      return new Promise(function (resolve, reject) {
        d3.json(layer.url, function(err, data) {
          if (err) return reject(err);

          var geojson = topojson.feature(data, data.objects[layer.id]);

          vm.state.map.aggregationLayer = geojson;
          vm.updateAggregation(id, vm.state.variable);

          vm.setStatus('Ready!');
          return resolve(geojson);
        });
      });
    },
    selectStates: function (states) {
      console.log('app:selectStates()', states);
      this.xf.setFilter('stusps', states);
      this.state.states = states;
      this.$set(this.state.xf.filters, 'stusps', states);
    },
    selectVariable: function (id) {
      console.log('app:selectVariable()', id);
      var vm = this;

      var variable = this.dataset.variables.filter(function (d) {
        return d.id == id;
      })[0];

      if (!variable) {
        console.error('Cannot find variable:', id);
        return;
      }

      this.state.map.colorScale = d3.scale.linear().domain([variable.min, variable.max]).range(['hsl(62,100%,90%)', 'hsl(222,30%,20%)']).clamp(true).interpolate(d3.interpolateHcl);

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
