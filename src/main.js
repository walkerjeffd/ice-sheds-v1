var Vue = require('vue'),
    VueResource = require('vue-resource'),
    Promise = require('bluebird'),
    topojson = require('topojson-client'),
    queryString = require('query-string'),
    Clipboard = require('clipboard');

Vue.use(VueResource);
Vue.component('select-picker', require('./components/selectPicker'));
Vue.component('ice-filter', require('./components/iceFilter'));
Vue.component('ice-map', require('./components/iceMap'));
Vue.component('ice-status', require('./components/iceStatus'));

var IceCrossfilter = require('./components/iceCrossfilter.js');

var serializeState = function (state) {
  var obj = {
    variable: state.variable,
    layer: state.layer,
    filters: {
      charts: [],
      region: state.filters.region
    },
    map: {
      view: {
        center: state.map.view.center,
        zoom: state.map.view.zoom
      }
    }
  };

  state.xf.filters.forEach(function (filter) {
    obj.filters.charts.push({
      id: filter.id,
      range: filter.range
    });
  });

  // stringify nested objects
  ['filters', 'map'].forEach(function (key) {
    obj[key] = JSON.stringify(obj[key]);
  })

  return queryString.stringify(obj);
};

var deserializeState = function (query) {
  if (!query) return;

  var parsed = queryString.parse(query);

  // parse stringified nested objects
  ['filters', 'map'].forEach(function (key) {
    if (parsed[key]) parsed[key] = JSON.parse(parsed[key]);
  })

  return parsed;
};


var app = window.app = new Vue({
  el: '#app',
  data: {
    shareUrl: '',
    dataset: {},
    config: {
      layer: {
        config: {},
        options: []
      },
      variable: {
        config: {},
        options: []
      },
      filters: {
        charts: {
          config: {
            selectedTextFormat: 'count',
            countSelectedText: '{0} variables selected'
          },
          options: []
        },
        region: {
          config: {
            actionsBox: true,
            selectedTextFormat: 'count',
            countSelectedText: '{0} states selected'
          },
          options: []
        }
      },
      map: {
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
    state: {
      message: 'Initializing...',
      layer: null,
      variable: null,
      filters: {
        charts: [],
        region: []
      },
      xf: {
        filters: []
      },
      map: {
        view: {
          center: [42.2, -71.1],
          zoom: 6
        },
        aggregationLayer: undefined,
        getColor: function (id) {
          return Math.random();
        }.bind(this)
      }
    },
  },
  mounted: function () {
    var vm = this;

    // initialize share copy-to-clipboard button
    new Clipboard('.btn-copy');

    // initialize crossfilter
    vm.xf = IceCrossfilter();

    // load dataset
    vm.loadDataset('/data/dataset/sheds-default.json');
  },
  methods: {
    loadDataset: function (url) {
      console.log('app:loadDataset()', url);

      var vm = this;

      vm.fetchConfig(url)
        .then(function (config) {
          vm.$set(vm.dataset, 'config', config);
          return vm.dataset.config;
        })
        .then(vm.loadConfig)
        .then(vm.fetchDataset)
        .then(function (data) {
          var config = vm.dataset.config;

          vm.xf.areaColumn(config.columns.area)
            .data(data)
            .addCategoricalDim(config.regions.id);

          vm.state.map.getColor = function (id) {
            var value = vm.xf.getAggregationValue(id);
            return value === null ? '#EEE' : vm.state.map.colorScale(value);
          };

          vm.updateState(config.state);
          var queryState = deserializeState(location.search);
          vm.updateState(queryState);

          vm.selectVariable(vm.state.variable);
          vm.selectStates(vm.state.filters.region);
          vm.selectFilters(vm.state.filters.charts);

          // update filter ranges from queryState
          // b/c state.filters.charts does not include filter ranges
          // so ranges are not set in selectFilters()
          if (queryState && queryState.filters && queryState.filters.charts) {
            queryState.filters.charts.forEach(function (filter) {
              filter.range && vm.setFilter(filter.id, filter.range);
            });
          }

          return vm.selectLayer(vm.state.layer);
        })
        .catch(function (err) {
          console.error(err);
          alert('Failed to load dataset');
        });
    },
    fetchConfig: function (url) {
      console.log('app:fetchConfig()', url);

      var vm = this;

      return vm.$http.get(url)
        .then(function (response) {
          if (!response.body) throw new Error('Failed to fetch dataset configuration file (empty response)');

          vm.$set(vm.dataset, 'url', url);

          var datasetConfig = response.body;

          return datasetConfig;
        })
        .catch(function (response) {
          console.error(response);
          throw new Error('Failed to fetch dataset configuration file (server error)')
        });
    },
    loadConfig: function (config) {
      console.log('app:loadConfig()');

      var vm = this;

      // initialize select picker options
      vm.config.layer.options = config.layers.map(function (d) {
          return {
            id: d.id,
            label: d.label
          };
        });
      vm.config.variable.options = config.variables.filter(function (d) {
          return d.aggregation;
        }).map(function (d) {
          return {
            id: d.id,
            label: d.label
          };
        });
      vm.config.filters.region.options = config.regions.options.map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });
      vm.config.filters.charts.options = config.variables.filter(function (d) {
          return d.filter;
        }).map(function (d) {
          return {
            id: d.id,
            label: d.label
          };
        });

      return config;
    },
    fetchDataset: function (config) {
      console.log('app:fetchDataset()', config);
      var vm = this;

      vm.setStatus('Loading dataset...');
      return new Promise(function (resolve, reject) {
        d3.csv(config.data.url, function(err, data) {
          if (err) return reject(err);

          data.forEach(function(d) {
            config.variables.forEach(function(v) {
              d[v.id] = d[v.id] === "" ? null : +d[v.id]/v.scale;
            });

            d[config.columns.area] = +d[config.columns.area];

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
    setMapView: function (center, zoom) {
      if (center) this.state.map.view.center = center;
      if (zoom) this.state.map.view.zoom = zoom;
    },
    updateState: function (newState) {
      if (!newState) return;

      console.log('app:updateState()', newState);

      var state = this.state,
          vm = this;

      state.variable = newState.variable || state.variable;
      state.layer = newState.layer || state.layer;
      state.variable = newState.variable || state.variable;

      if (newState.filters) {
        state.filters.region = newState.filters.region || state.filters.region;

        if (newState.filters.charts) {
          state.filters.charts = newState.filters.charts.map(function (d) { return d.id; });
        }
      }

      if (newState.map && newState.map.view) {
        if (newState.map.view.center) {
          state.map.view.center = newState.map.view.center;
        }
        if (newState.map.view.zoom) {
          state.map.view.zoom = newState.map.view.zoom;
        }
      }
    },
    addFilter: function (id, range) {
      console.log('app:addFilter()', id, range);
      var vm = this;

      var variable = this.getVariable(id);
      if (!variable) {
        console.error('Cannot find variable', id);
        return;
      }

      var filter = {
        id: id,
        variable: variable,
        getDim: function () {
          return vm.xf.getDim(id);
        },
        getSelectedDim: function () { return; }
      };

      this.xf.addFilterDim(id, variable).setFilterDimRange(id, range);
      if (this.state.selected) {
        this.state.selected.xf.addFilterDim(id, variable).setFilterDimRange(id, range);
        filter.getSelectedDim = function () {
          return vm.state.selected.xf.getDim(filter.id);
        }
      }

      this.state.xf.filters.push(filter);
      if (this.state.filters.charts.indexOf(id) < 0) {
        this.state.filters.charts.push(id);
      }
    },
    removeFilter: function (id) {
      console.log('app:removeFilter()', id);
      var idx = this.state.xf.filters.map(function (d) {
        return d.id;
      }).indexOf(id);

      if (idx < 0) {
        console.error('Unable to remove filter:' + id);
        return;
      }

      this.xf.removeFilterDim(id);
      if (this.state.selected) {
        this.state.selected.xf.removeFilterDim(id);
      }

      this.state.xf.filters.splice(idx, 1);

      idx = this.state.filters.charts.indexOf(id);
      if (idx >= 0) {
        this.state.filters.charts.splice(idx, 1);
      }
    },
    setFilter: function (id, range) {
      // console.log('app:setFilter()', id, range);
      var vm = this;

      var idx = this.state.xf.filters.map(function (d) {
        return d.id;
      }).indexOf(id);

      if (idx < 0) {
        console.error('Unable to find filter:' + id);
        return;
      }

      this.xf.setFilterDimRange(id, range);
      if (this.state.selected) {
        this.state.selected.xf.setFilterDimRange(id, range);
      }

      this.$set(this.state.xf.filters[idx], 'range', range);
    },
    getVariable: function (id) {
      return this.dataset.config.variables.filter(function (d) {
        return d.id == id;
      })[0]
    },
    selectFilters: function (filters) {
      console.log('app:selectFilters()', filters);
      var vm = this;

      // if filter already exists, remove it
      this.state.filters.charts.forEach(function (filter) {
        if (filters.indexOf(filter) < 0) {
          vm.removeFilter(filter);
        }
      });

      // if filter does not exist, add it
      filters.forEach(function (filter) {
        if (vm.state.xf.filters.map(function (d) { return d.id; }).indexOf(filter) < 0) {
          console.log(filter);
          vm.addFilter(filter);
        }
      });

      this.state.filters.charts = filters;
    },
    selectLayer: function (id) {
      console.log('app:selectLayer()', id);
      var vm = this;

      var layer = vm.dataset.config.layers.filter(function (d) {
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

          vm.selectFeature();

          vm.state.map.aggregationLayer = geojson;
          vm.updateAggregation(id, vm.state.variable);

          vm.setStatus('Ready!');
          return resolve(geojson);
        });
      });
    },
    selectStates: function (states) {
      console.log('app:selectStates()', states);
      this.xf.setCategoricalDimFilter(this.dataset.config.regions.id, states);
      if (this.state.selected) this.state.selected.xf.setCategoricalDimFilter(this.dataset.config.regions.id, states);

      this.state.filters.region = states;
      this.$set(this.state.xf, this.dataset.config.regions.id, states);
    },
    selectVariable: function (id) {
      console.log('app:selectVariable()', id);
      var vm = this;

      var variable = this.getVariable(id);

      if (!variable) {
        console.error('Cannot find variable:', id);
        return;
      }

      this.state.map.colorScale = d3.scale.linear().domain([variable.min, variable.max]).range(['hsl(62,100%,90%)', 'hsl(222,30%,20%)']).clamp(true).interpolate(d3.interpolateHcl);

      this.updateAggregation(this.state.layer, id);
    },
    selectFeature: function (feature) {
      var vm = this;
      if (feature) {
        console.log('app:selectFeature(' + feature.id + ') create');
        this.$set(this.state, 'selected', feature);

        // create new crossfilter using only data for selected feature
        var subset = this.xf.data().filter(function (d) {
          return d[vm.state.layer] === feature.id;
        });
        var xf = this.state.selected.xf = IceCrossfilter().data(subset);

        // add categorical dimensions
        xf.addCategoricalDim(vm.dataset.config.regions.id)
          .setCategoricalDimFilter(vm.dataset.config.regions.id, this.state.filters.region);

        // add filter dimensions
        this.state.xf.filters.forEach(function (filter) {
          xf.addFilterDim(filter.id, filter.variable).setFilterDimRange(filter.id, filter.range);
          filter.getSelectedDim = function () {
            return xf.getDim(filter.id);
          };
        });
      } else if (this.state.selected) {
        console.log('app:selectFeature(' + this.state.selected.id + ') destroy');
        this.state.selected.xf.destroy();
        this.state.filters.charts.forEach(function (filter) {
          filter.getSelectedDim = function () { return; };
        });
        this.$delete(this.state, 'selected');
      }
    },
    setStatus: function (message) {
      this.state.message = message;
    },
    share: function () {
      var query = serializeState(this.state),
          url = location.origin + location.pathname + '?' + query;

      this.shareUrl = url;

      $('#modal-share').modal('show')
    },
    updateAggregation: function (layer, variable) {
      console.log('app:updateAggregation()', layer, variable);
      this.state.layer = layer;
      this.state.variable = variable;
      this.xf.setAggregation(this.state.layer, this.state.variable);
    }
  }
})
