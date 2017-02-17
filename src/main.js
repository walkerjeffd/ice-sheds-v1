var Vue = require('vue'),
    VueResource = require('vue-resource'),
    Promise = require('bluebird'),
    topojson = require('topojson-client'),
    queryString = require('query-string'),
    Clipboard = require('clipboard');

var config = require('./config');

var evt = new Vue();

Vue.use(VueResource);
Vue.component('select-picker', require('./components/selectPicker'));
Vue.component('ice-filter', require('./components/iceFilter'));
Vue.component('ice-map', require('./components/iceMap')(evt));
Vue.component('ice-status', require('./components/iceStatus'));
Vue.component('ice-select-info-aggregation', require('./components/iceSelectInfoAggregation'));
Vue.component('ice-select-info-catchment', require('./components/iceSelectInfoCatchment'));
Vue.component('ice-legend', require('./components/iceLegend'));


var IceCrossfilter = require('./components/iceCrossfilter.js');

var downloadJsonFile = function (data, filename) {
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  var json = JSON.stringify(data),
      blob = new Blob([json], {type: "octet/stream"}),
      url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

var serialize = function (state) {
  var obj = {
    configUrl: state.configUrl,
    variable: state.variable,
    layer: state.layer,
    filters: {
      charts: [],
      region: state.filters.region
    },
    selected: {
    },
    map: {
      view: {
        center: state.map.view.center,
        zoom: state.map.view.zoom
      }
    }
  };

  if (state.selected.aggregation) {
    obj.selected.aggregationId = state.selected.aggregation.id;
  }

  state.xf.filters.forEach(function (filter) {
    obj.filters.charts.push({
      id: filter.id,
      range: filter.range
    });
  });

  // stringify nested objects
  ['selected', 'filters', 'map'].forEach(function (key) {
    obj[key] = JSON.stringify(obj[key]);
  })

  return queryString.stringify(obj);
};

var deserialize = function (query) {
  if (!query) return;

  var parsed = queryString.parse(query);

  // parse stringified nested objects
  ['selected', 'filters', 'map'].forEach(function (key) {
    if (parsed[key]) parsed[key] = JSON.parse(parsed[key]);
  })

  return parsed;
};

var numberFormat = d3.format(',');

var app = window.app = new Vue({
  el: '#app',
  data: {
    shareUrl: '',
    show: {
      loading: true
    },
    dataset: {
      count: 0,
      loaded: false
    },
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
      configUrl: '/data/dataset/sheds-default.json',
      message: 'Initializing...',
      layer: null,
      variable: null,
      filters: {
        charts: [],
        region: []
      },
      xf: {
        filters: [],
        count: {
          total: 0,
          filtered: 0
        }
      },
      selected: {
        count: {
          total: 0,
          filtered: 0
        }
      },
      map: {
        view: {
          center: [42.2, -71.1],
          zoom: 6
        },
        aggregationLayer: undefined,
        getAggregationValue: function () { return null; },
        getCatchmentValue: function () { return null; }
      }
    },
  },
  filters: {
    number: function (value) {
      return numberFormat(value);
    }
  },
  mounted: function () {
    var vm = this;

    // initialize share copy-to-clipboard button
    new Clipboard('.btn-copy');

    // initialize crossfilter
    this.xf = IceCrossfilter();

    // parse search query string
    var query = deserialize(location.search);

    // load dataset
    var configUrl = query && query.configUrl || this.state.configUrl;
    this.loadDataset(configUrl, query);
  },
  computed: {
    variable: function () {
      if (this.state.variable === '*area') {
        return {
          "id": "*area",
          "label": "% Area Filtered",
          "min": 0,
          "max": 1,
          "scale": 1,
          "interval": 0.025,
          "format": {
            "value": "%",
            "axis": "%"
          }
        };
      } else {
        return this.getVariableById(this.state.variable);
      }
    },
    layer: function () {
      return this.getLayerById(this.state.layer);
    },
    colorScale: function () {
      var variable = this.variable,
          domain = [0, 1];

      if (variable) {
        domain = [variable.min, variable.max];
      }

      return d3.scale.linear().domain(domain).range(['hsl(222,30%,20%)', 'hsl(62,100%,90%)']).clamp(true).interpolate(d3.interpolateHcl);
    },
    featureType: function () {
      if (!this.layer) {
        return '';
      }
      return this.layer.label;
    },
    selectedAggregationLabel: function () {
      if (!this.state.selected.aggregation) {
        return 'None';
      }

      return this.state.selected.aggregation.id + ' | ' + this.state.selected.aggregation.properties.name;
    }
  },
  methods: {
    loadDataset: function (url, query) {
      console.log('app:loadDataset()', url);

      var vm = this;

      vm.setStatus('Loading dataset...');
      vm.show.loading = true;

      return vm.fetchConfig(url)
        .then(function (config) {
          vm.$set(vm.dataset, 'config', config);
          return vm.dataset.config;
        })
        .then(vm.loadConfig)
        .then(vm.fetchDataset)
        .then(function (data) {
          var config = vm.dataset.config;

          vm.dataset.loaded = true;

          vm.xf
            .areaColumn(config.columns.area)
            .idColumn(config.columns.id)
            .data(data);

          if (config.region) {
            vm.xf.addCategoricalDim(config.region.id);
          }

          vm.state.xf.count.total = data.length;
          vm.state.xf.count.filtered = vm.xf.getFilteredCount();

          vm.state.map.getAggregationValue = function (id) {
            return vm.xf.getAggregationValue(id);
          };
          vm.state.map.getCatchmentValue = function (id) {
            if (vm.state.variable === '*area') {
              return vm.xf.hasCatchment(id) ? 1 : 0;
            } else {
              return vm.xf.hasCatchment(id) ? vm.xf.getCatchmentValue(id, vm.state.variable) : null;
            }
          };

          vm.updateState(config.state);
          vm.updateState(query);

          vm.selectVariable(vm.state.variable);
          vm.selectFiltersRegion(vm.state.filters.region);
          vm.selectFiltersCharts(vm.state.filters.charts);

          // update filter ranges from query
          // b/c state.filters.charts does not include filter ranges
          // so ranges are not set in selectFiltersCharts()
          if (query && query.filters && query.filters.charts) {
            query.filters.charts.forEach(function (filter) {
              filter.range && vm.setFilter(filter.id, filter.range);
            });
          }

          return vm.selectLayer(vm.state.layer)
            .then(function () {
              // select feature from query
              if (query && query.selectedId) {
                var features = vm.state.map.aggregationLayer.features.filter(function (d) {
                  return d.id === query.selectedId;
                });

                if (features.length > 0) {
                  vm.selectAggregation(features[0]);
                }
              }
            });
        })
        .then(function () {
          vm.setStatus();
        })
        .catch(function (err) {
          console.error(err);
          vm.setStatus('Error');
          alert('Failed to load dataset');
        })
        .finally(function () {
          vm.show.loading = false;
        });
    },
    fetchConfig: function (url) {
      console.log('app:fetchConfig()', url);

      var vm = this;

      return vm.$http.get(url)
        .then(function (response) {
          if (!response.body) throw new Error('Failed to fetch dataset configuration file (empty response)');

          vm.$set(vm.state, 'configUrl', url);

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

      var variableOptions = [{
        id: '*area',
        label: '% Area Filtered'
      }];
      config.variables.filter(function (d) {
          return d.aggregation;
        })
        .forEach(function (d) {
          variableOptions.push({
            id: d.id,
            label: d.label
          });
        });
      vm.config.variable.options = variableOptions;

      if (config.region) {
        vm.config.filters.region.options = config.region.options.map(function (d) {
          return {
            id: d.id,
            label: d.label
          };
        });
      }

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

      this.setStatus('Adding filter...');

      setTimeout(function () {
        var variable = vm.getVariableById(id);

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

        vm.xf.addFilterDim(id, variable).setFilterDimRange(id, range);
        if (vm.state.selected.xf) {
          vm.state.selected.xf.addFilterDim(id, variable).setFilterDimRange(id, range);
          filter.getSelectedDim = function () {
            return vm.state.selected.xf.getDim(filter.id);
          }
        }

        vm.state.xf.filters.push(filter);
        if (vm.state.filters.charts.indexOf(id) < 0) {
          vm.state.filters.charts.push(id);
        }

        vm.setStatus();
      }, 0)
    },
    removeFilter: function (id) {
      console.log('app:removeFilter()', id);

      var vm = this;

      this.setStatus('Removing filter...');

      setTimeout(function () {
        var idx = this.state.xf.filters.map(function (d) {
          return d.id;
        }).indexOf(id);

        if (idx < 0) {
          console.error('Unable to remove filter:' + id);
          return;
        }

        this.xf.removeFilterDim(id);
        if (this.state.selected.xf) {
          this.state.selected.xf.removeFilterDim(id);
        }

        this.state.xf.filters.splice(idx, 1);

        idx = this.state.filters.charts.indexOf(id);
        if (idx >= 0) {
          this.state.filters.charts.splice(idx, 1);
        }

        this.state.xf.count.filtered = this.xf.getFilteredCount();
        if (vm.state.selected.xf) {
          vm.state.selected.count.filtered = vm.state.selected.xf.getFilteredCount();
        }

        evt.$emit('refresh-map');

        this.setStatus();
      }.bind(this), 0);
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
      if (this.state.selected.xf) {
        this.state.selected.xf.setFilterDimRange(id, range);
      }

      this.$set(this.state.xf.filters[idx], 'range', range);
      this.state.xf.count.filtered = this.xf.getFilteredCount();

      if (this.state.selected.xf) {
        vm.state.selected.count.filtered = this.state.selected.xf.getFilteredCount();
      }

      evt.$emit('refresh-map');
    },
    getVariableById: function (id) {
      var variable;

      if (this.dataset.config && id) {
        variable = this.dataset.config.variables.filter(function (d) {
          return d.id == id;
        })[0];
      }

      return variable;
    },
    getLayerById: function (id) {
      var layer;

      if (this.dataset.config && id) {
        layer = this.dataset.config.layers.filter(function (d) {
          return d.id == id;
        })[0];
      }

      return layer;
    },
    selectFiltersCharts: function (filters) {
      console.log('app:selectFiltersCharts()', filters);
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

      var layer = this.getLayerById(id);

      if (!layer) {
        console.error('Unable to get layer', id);
        return;
      }

      vm.setStatus('Loading layer...');
      vm.show.loading = true;
      // fetch geojson from server
      return new Promise(function (resolve, reject) {
        d3.json(layer.url, function(err, data) {
          if (err) return reject(err);

          var geojson = topojson.feature(data, data.objects[layer.id]);

          vm.selectAggregation();

          vm.state.map.aggregationLayer = geojson;
          vm.updateAggregation(id, vm.state.variable);
          // vm.xf.updateStats(id, vm.dataset.config.variables);

          vm.setStatus();
          vm.show.loading = false;
          return resolve(geojson);
        });
      });
    },
    selectFiltersRegion: function (values) {
      console.log('app:selectFiltersRegion()', values);

      if (!this.dataset.config.region) {
        return;
      }

      this.setStatus('Setting region filter...');

      setTimeout(function () {
        this.xf.setCategoricalDimFilter(this.dataset.config.region.id, values);
        if (this.state.selected.xf) {
          this.state.selected.xf.setCategoricalDimFilter(this.dataset.config.region.id, values);
        }

        this.state.filters.region = values;
        this.$set(this.state.xf, this.dataset.config.region.id, values);

        this.setStatus();
      }.bind(this), 0);
    },
    selectVariable: function (id) {
      console.log('app:selectVariable(%s)', id);

      this.setStatus('Setting map variable...');

      setTimeout(function () {
        this.state.variable = id;
        this.updateAggregation(this.state.layer, id);
        this.setStatus();
      }.bind(this), 0);
    },
    aggregationTooltip: function (d) {
      // map tooltip on feature mouseover
      // d: aggregation feature object
      var layer = this.getLayerById(this.state.layer),
          format = d3.format(this.variable.format.value),
          value = this.state.map.getAggregationValue(d.id),
          formattedValue = value === null ? 'N/A' : format(value);

      return '<span>' + layer.label + ': ' + d.id + ' | ' + d.properties.name + '</span><br><span>' + this.variable.label + ' = ' + formattedValue + '</span>';
    },
    catchmentTooltip: function (d) {
      // map tooltip on catchment mouseover
      // d: catchment feature object
      var format = d3.format(this.variable.format.value),
          value = this.state.map.getCatchmentValue(d.id),
          formattedValue = value === null ? 'N/A' : format(value);

      return '<span>Catchment: ' + d.id + '</span><br>' +
        '<span>' + this.variable.label + ' = ' + formattedValue + '</span>';
    },
    selectAggregation: function (feature) {
      var vm = this;
      if (feature) {
        // select

        if (!vm.state.selected.aggregation || feature.id !== vm.state.selected.aggregation.id) {
          // selecting new feature
          console.log('app:selectAggregation(' + feature.id + ') select');
          vm.setStatus('Selecting feature...');

          setTimeout(function () {
            vm.$set(vm.state.selected, 'aggregation', feature);

            // delete existing selected xf
            if (vm.state.selected.xf) {
              vm.state.selected.xf.destroy();
              vm.$delete(vm.state.selected, 'xf');
            }

            // create new crossfilter using only data for selected feature
            var subset = vm.xf.data().filter(function (d) {
              return d[vm.state.layer] === feature.id;
            });
            var xf = IceCrossfilter().data(subset);
            vm.$set(vm.state.selected, 'xf', xf);

            // add categorical dimensions
            if (vm.dataset.config.region) {
              xf.addCategoricalDim(vm.dataset.config.region.id)
                .setCategoricalDimFilter(vm.dataset.config.region.id, vm.state.filters.region);
            }

            // add filter dimensions
            vm.state.xf.filters.forEach(function (filter) {
              xf.addFilterDim(filter.id, filter.variable).setFilterDimRange(filter.id, filter.range);
              filter.getSelectedDim = function () {
                return xf.getDim(filter.id);
              };
            });

            // update counts
            vm.$set(vm.state.selected.count, 'total', subset.length);
            vm.$set(vm.state.selected.count, 'filtered', vm.state.selected.xf.getFilteredCount());

            // delete selected catchment
            if (vm.state.selected.catchment) {
              vm.$delete(vm.state.selected, 'catchment');
            }

            if (vm.state.map.catchmentLayer) {
              // replace current catchments with new catchments
              vm.$delete(vm.state.map, 'catchmentLayer');

              // // Automatically switch to catchment view on new selection??
              // vm.zoomToCatchments(feature);
            }

            vm.setStatus();
          }, 0);
        } else {
          // feature already selected, do nothing
        }
      } else {
        // unselect

        if (vm.state.selected.aggregation) {
          // remove current selection
          console.log('app:selectAggregation(' + vm.state.selected.aggregation.id + ') unselect');

          vm.setStatus('Unselecting feature...');

          setTimeout(function () {
            vm.state.selected.xf.destroy();
            vm.state.xf.filters.forEach(function (filter) {
              filter.getSelectedDim = function () { return; };
            });
            vm.$delete(vm.state.selected, 'aggregation');
            vm.$delete(vm.state.selected, 'catchment');
            vm.$delete(vm.state.selected, 'xf');
            vm.$delete(vm.state.map, 'catchmentLayer');
            vm.$set(vm.state.selected.count, 'total', 0);
            vm.$set(vm.state.selected.count, 'filtered', 0);

            vm.setStatus();
          }, 0);
        } else {
          // no current selection, do nothing
        }
      }
    },
    selectCatchment: function (feature) {
      if (feature) {
        console.log('app:selectCatchment(' + feature.id + ') select');
        this.$set(this.state.selected, 'catchment', feature);
      } else if (this.state.selected.catchment) {
        console.log('app:selectCatchment(' + this.state.selected.catchment.id + ') unselect');
        this.$delete(this.state.selected, 'catchment');
      } else {
        console.log('app:selectCatchment() no change');
      }
    },
    setStatus: function (message) {
      this.state.message = message;
    },
    updateAggregation: function (layer, variable) {
      console.log('app:updateAggregation()', layer, variable);
      this.state.layer = layer;
      this.state.variable = variable;
      this.xf.setAggregation(this.state.layer, this.state.variable);
    },
    zoomToCatchments: function (feature) {
      console.log('app:zoomToCatchments(%s)', feature && feature.id);

      var vm = this;

      vm.show.loading = true;

      this.setStatus('Zooming to catchments...');

      var params = {};
      params[this.state.layer] = feature.id;

      // fetch catchments from api
      this.$http.get(config.api.url + '/catchments', {
          params: params
        })
        .then(function (response) {
          vm.$set(vm.state.map, 'catchmentLayer', response.data.data);
        })
        .catch(function (response) {
          console.log('error', response);
          alert('Error occurred fetching catchments');
        })
        .finally(function () {
          vm.show.loading = false;
          this.setStatus();
        });
    },
    share: function () {
      var query = serialize(this.state),
          url = location.origin + location.pathname + '?' + query;

      this.shareUrl = url;

      $('#modal-share').modal('show')
    },
    downloadAggregationLayer: function () {
      var vm = this;
      this.setStatus('Downloading file...');

      setTimeout(function () {
        var features = this.state.map.aggregationLayer.features.map(function (d) {
          var props = {
            name: d.properties.name
          };
          props[vm.state.layer] = d.id;
          props[vm.state.variable] = vm.xf.getAggregationValue(d.id);

          return {
            type: d.type,
            id: d.id,
            properties: props,
            geometry: d.geometry
          };
        });

        var data = {
          type: "FeatureCollection",
          features: features
        };

        downloadJsonFile(data, 'ice-sheds-' + this.state.layer + '.geojson');

        this.setStatus();
      }.bind(this), 0)
    }
  }
})
