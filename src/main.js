var Vue = require('vue'),
    VueResource = require('vue-resource'),
    Promise = require('bluebird'),
    topojson = require('topojson-client'),
    json2csv = require('json2csv'),
    queryString = require('query-string'),
    Clipboard = require('clipboard'),
    Joi = require('joi');

var config = require('./config');

var evt = new Vue();

Vue.use(VueResource);
Vue.component('select-picker', require('./components/selectPicker'));
Vue.component('ice-filter', require('./components/iceFilter')(evt));
Vue.component('ice-map', require('./components/iceMap')(evt));
Vue.component('ice-status', require('./components/iceStatus'));
Vue.component('ice-select-aggregation', require('./components/iceSelectAggregation'));
Vue.component('ice-select-catchment', require('./components/iceSelectCatchment'));
Vue.component('ice-legend', require('./components/iceLegend'));

var IceCrossfilter = require('./components/iceCrossfilter.js');

var downloadFile = function (data, filename) {
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  var blob = new Blob([data], {type: "octet/stream"}),
      url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

var numberFormat = d3.format(',.0f');

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
        config: {
          dropupAuto: false
        },
        options: []
      },
      variable: {
        config: {
          dropupAuto: false
        },
        options: []
      },
      filters: {
        charts: {
          config: {
            selectedTextFormat: 'count',
            countSelectedText: '{0} variables selected',
            dropupAuto: false
          },
          options: []
        },
        regions: {
          stusps: {
            config: {
              actionsBox: true,
              selectedTextFormat: 'count',
              countSelectedText: '{0} states selected',
              dropupAuto: false
            },
            options: []
          }
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
        regions: {
          stusps: [],
          huc2: []
        }
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
        showUnselectedAggregation: true,
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

    // initialize interface
    this.initializeUi();

    // initialize crossfilter
    this.xf = IceCrossfilter();

    // parse search query string
    var query = vm.dataset.query = this.deserializeUrl(location.search);

    // load dataset
    var configUrl = query && query.configUrl || this.state.configUrl;
    this.loadDataset(configUrl);
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
    loadDataset: function (url) {
      console.log('app:loadDataset()', url);

      var vm = this,
          query = vm.dataset.query;

      vm.setStatus('Loading dataset...');
      vm.show.loading = true;

      return vm.fetchConfig(url)
        .then(function (config) {
          vm.$set(vm.dataset, 'config', config);
          return config;
        })
        .then(vm.validateUrl)
        .then(function (query) {
          vm.$set(vm.dataset, 'query', query);
          return vm.dataset.config;
        })
        .then(vm.loadConfig)
        .then(vm.fetchDataset)
        .then(function (data) {
          // set up crossfilter
          var config = vm.dataset.config,
              query = vm.dataset.query;

          vm.dataset.loaded = true;

          vm.xf
            .areaColumn(config.columns.area)
            .idColumn(config.columns.id)
            .data(data);

          config.regions.forEach(function (region) {
            vm.xf.addCategoricalDim(region.id);
          });

          // counts
          vm.state.xf.count.total = data.length;
          vm.state.xf.count.filtered = vm.xf.getFilteredCount();

          // map getters
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

          // set default state and update with query
          vm.updateState(config.state);
          vm.updateState(query);

          return Promise.resolve();
        })
        .then(function () {
          console.log('init:select variable and filters');
          vm.selectVariable(vm.state.variable);
          vm.selectFiltersStates(vm.state.filters.regions.stusps);
          vm.selectFiltersCharts(vm.state.filters.charts);

          return vm.selectLayer(vm.state.layer);
        })
        .then(function () {
          // select feature from query
          console.log('init:query.selected.aggregation');
          var query = vm.dataset.query;

          if (query && query.selected && query.selected.aggregation) {
            var features = vm.state.map.aggregationLayer.features.filter(function (d) {
              return d.id === query.selected.aggregation;
            });

            var feature = features[0];

            if (feature) {
              vm.selectAggregation(feature);

              if (query.map && query.map.showUnselectedAggregation !== undefined) {
                vm.state.map.showUnselectedAggregation = query.map.showUnselectedAggregation;
              }

              return Promise.resolve(feature);
            } else {
              return Promise.reject(new Error('Failed to select feature "' + query.selected.aggregation + '"'));
            }
          } else {
            return Promise.resolve();
          }
        })
        .then(function (feature) {
          // show catchments
          console.log('init:query.selected.aggregation');
          var query = vm.dataset.query;

          if (query && query.catchments && feature) {
            return vm.fetchCatchments(feature)
              .catch(function (response) {
                console.error('Error fetching catchments', response);
                throw new Error('Failed to get catchments from server');
              });
          } else {
            return Promise.resolve();
          }
        })
        .then(function () {
          // select catchment
          console.log('init:query.selected.catchment');
          var query = vm.dataset.query;

          if (query && query.selected && query.selected.catchment) {
            var features = vm.state.map.catchmentLayer.features.filter(function (d) {
              return d.id === query.selected.catchment;
            });

            var feature = features[0];

            if (feature) {
              vm.selectCatchment(feature);
              return Promise.resolve();
            } else {
              return Promise.reject(new Error('Failed to select catchment "' + query.selected.catchment + '"'));
            }
          } else {
            return Promise.resolve();
          }
        })
        .then(function () {
          // update filter ranges from query
          // b/c state.filters.charts does not include filter ranges (only ids)
          // so ranges are not set in selectFiltersCharts()
          console.log('init:query.filters.charts range');
          var query = vm.dataset.query;

          if (query && query.filters && query.filters.charts) {
            query.filters.charts.forEach(function (filter) {
              filter.range && vm.setFilter(filter.id, filter.range);
            });
          }

          return Promise.resolve();
        })
        .then(function () {
          vm.setStatus();
        })
        .catch(function (err) {
          console.error(err);
          vm.setStatus('Error');
          alert('Error: ' + err.message);
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
          if (!response.body) throw new Error('Failed to fetch configuration file (empty response)');

          vm.$set(vm.state, 'configUrl', url);

          var config = response.body;

          return config;
        })
        .catch(function (response) {
          console.error(response);
          throw new Error('Failed to fetch configuration file');
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

      config.regions.forEach(function (region) {
        if (region.options) {
          vm.config.filters.regions[region.id].options = region.options.map(function (d) {
            return {
              id: d.id,
              label: d.label
            };
          });
        }
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
            d.huc2 = d.huc12.substr(0, 2);
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
        if (newState.filters.regions) {
          newState.filters.regions.forEach(function (region) {
            state.filters.regions[region.id] = region.values || state.filters.regions[region.id];
          });
        }

        if (newState.filters.charts) {
          state.filters.charts = newState.filters.charts.map(function (d) { return d.id; });
        }
      }

      if (newState.map) {
        if (newState.map.view) {
          if (newState.map.view.center) {
            state.map.view.center = newState.map.view.center;
          }
          if (newState.map.view.zoom) {
            state.map.view.zoom = newState.map.view.zoom;
          }
        }
        if (newState.map.showUnselectedAggregation !== undefined) {
          state.map.showUnselectedAggregation = newState.map.showUnselectedAggregation;
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

        evt.$emit('map:refresh');

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

      this.state.xf.filters[idx].range = range;
      this.state.xf.count.filtered = this.xf.getFilteredCount();

      if (this.state.selected.xf) {
        vm.state.selected.count.filtered = this.state.selected.xf.getFilteredCount();
      }

      Vue.nextTick(function () {
        evt.$emit('map:refresh');
        evt.$emit('filter:refresh')
      });
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

          if (vm.state.map.catchmentLayer)

          vm.selectCatchment();
          vm.selectAggregation();

          vm.state.map.aggregationLayer = geojson;
          vm.updateAggregation(id, vm.state.variable);
          // vm.xf.updateStats(id, vm.dataset.config.variables);

          if (layer.regions) {
            layer.regions.forEach(function (region) {
              if (region.values === '*') {
                vm.xf.setCategoricalDimFilter(region.id);
                vm.state.xf.count.filtered = vm.xf.getFilteredCount();
                if (vm.state.selected.xf) {
                  vm.state.selected.xf.setCategoricalDimFilter(region.id);
                  vm.state.selected.count.filtered = this.state.selected.xf.getFilteredCount();
                }
                vm.state.filters.regions[region.id] = vm.xf.getDim(region.id).group.all().map(function (d) { return d.key; });
              } else {
                vm.xf.setCategoricalDimFilter(region.id, region.values);
                vm.state.xf.count.filtered = vm.xf.getFilteredCount();
                if (vm.state.selected.xf) {
                  vm.state.selected.xf.setCategoricalDimFilter(region.id, region.values);
                  vm.state.selected.count.filtered = vm.state.selected.xf.getFilteredCount();
                }
                vm.state.filters.regions[region.id] = region.values;
              }
            })
          }

          vm.$delete(vm.state.map, 'catchmentLayer');

          evt.$emit('map:refresh');
          evt.$emit('filter:refresh');

          vm.setStatus();
          vm.show.loading = false;
          return resolve(geojson);
        });
      });
    },
    selectFiltersStates: function (values) {
      console.log('app:selectFiltersStates()', values);

      if (this.dataset.config.regions.stusps) {
        return;
      }

      this.setStatus('Setting states filter...');

      setTimeout(function () {
        this.xf.setCategoricalDimFilter('stusps', values);
        this.state.xf.count.filtered = this.xf.getFilteredCount();

        if (this.state.selected.xf) {
          this.state.selected.xf.setCategoricalDimFilter('stusps', values);
          this.state.selected.count.filtered = this.state.selected.xf.getFilteredCount();
        }

        this.state.filters.regions.stusps = values;
        this.$set(this.state.xf, 'stusps', values);
        evt.$emit('map:refresh');
        evt.$emit('filter:refresh');

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
      console.log('app:selectAggregation()', feature)
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
              return d[vm.layer.column] === feature.id;
            });
            var xf = IceCrossfilter().data(subset);
            vm.$set(vm.state.selected, 'xf', xf);

            // add categorical dimensions
            if (vm.dataset.config.regions) {
              vm.dataset.config.regions.forEach(function (region) {
                xf.addCategoricalDim(region.id)
                  .setCategoricalDimFilter(region.id, vm.state.filters.regions[region.id]);
              })
            }

            // add chart filter dimensions
            vm.state.xf.filters.forEach(function (filter) {
              xf.addFilterDim(filter.id, filter.variable).setFilterDimRange(filter.id, filter.range);
              filter.getSelectedDim = function () {
                return xf.getDim(filter.id);
              };
            });

            // update counts
            vm.$set(vm.state.selected.count, 'total', subset.length);
            vm.$set(vm.state.selected.count, 'filtered', vm.state.selected.xf.getFilteredCount());
            vm.$set(vm.state.selected, 'stats', vm.xf.getAreaById(feature.id));

            // delete selected catchment
            if (vm.state.selected.catchment) {
              vm.$delete(vm.state.selected, 'catchment');
            }

            if (vm.state.map.catchmentLayer) {
              // replace current catchments with new catchments
              vm.$delete(vm.state.map, 'catchmentLayer');

              // // Automatically switch to catchment view on new selection??
              // vm.showCatchments(feature);
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

        // reset show unselected aggregation
        vm.state.map.showUnselectedAggregation = true;
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
    updateAggregation: function (layerId, variable) {
      console.log('app:updateAggregation()', layerId, variable);
      this.state.layer = layerId;
      this.state.variable = variable;
      var layer = this.getLayerById(layerId);
      this.xf.setAggregation(layer.column, this.state.variable);
    },
    showCatchments: function (feature) {
      console.log('app:showCatchments(%s)', feature && feature.id);

      var vm = this;

      vm.show.loading = true;

      this.setStatus('Fetching catchments...');

      return this.fetchCatchments(feature)
        .then(function () {
          vm.setStatus();
        })
        .catch(function (error) {
          console.error('Failed to fetch catchments', error);
          alert('Failed to get catchments from server\n\n', error.message);
          vm.setStatus('Server Error');
        })
        .finally(function () {
          vm.show.loading = false;
        });
    },
    zoomToFeature: function (feature) {
      evt.$emit('map:zoomToFeature', feature);
    },
    fetchCatchments: function (feature) {
      console.log('app:fetchCatchments(%s)', feature && feature.id);

      var vm = this,
          params = {};
      params[this.layer.column] = feature.id;

      return this.$http.get(config.api.url + '/catchments', {
          params: params
        })
        .then(function (response) {
          vm.$set(vm.state.map, 'catchmentLayer', response.data.data);
        });
    },
    share: function () {
      var query = this.serializeUrl(this.state),
          url = location.origin + location.pathname + '?' + query;

      this.shareUrl = url;

      $('#modal-share').modal('show');
    },
    showDataAggregation: function (feature) {
      var vm = this,
          variables = vm.dataset.config.variables;

      this.setStatus('Opening data table...');

      setTimeout(function () {
        var values = vm.xf.computeStats(feature.id, variables);

        vm.state.selected.variableStats = {};
        variables.forEach(function (variable) {
            var formatter = d3.format(variable.format.value),
                value = values[variable.id];
            vm.state.selected.variableStats[variable.id] = value === null ? 'N/A' : formatter(values[variable.id]);
          });
        $('#modal-data-aggregation').modal('show');

        this.setStatus();
      }.bind(this), 0);
    },
    showDataCatchment: function (feature) {
      var vm = this,
          variables = vm.dataset.config.variables;

      this.setStatus('Opening data table...');

      setTimeout(function () {
        var values = vm.xf.getCatchmentValue(feature.id);
        vm.$set(vm.state.selected, 'catchmentStats', {});

        vm.state.selected.catchmentStats = {};
        variables.forEach(function (variable) {
            var formatter = d3.format(variable.format.value),
                value = values[variable.id];
            vm.state.selected.catchmentStats[variable.id] = value === null ? 'N/A' : formatter(values[variable.id]);
          });
        $('#modal-data-catchment').modal('show');

        this.setStatus();
      }.bind(this), 0);
    },
    downloadAggregationLayer: function () {
      var vm = this;
      this.setStatus('Downloading file...');

      setTimeout(function () {
        var features = this.state.map.aggregationLayer.features.map(function (d) {
          var props = {
            name: d.properties.name
          };
          props[vm.layer.column] = d.id;
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

        var json = JSON.stringify(data);

        downloadFile(json, 'ice-sheds-' + this.state.layer + '-' + this.state.variable + '.geojson');

        this.setStatus();
      }.bind(this), 0);
    },
    downloadCatchmentLayer: function (filtered) {
      var vm = this;
      this.setStatus('Downloading file...');

      setTimeout(function () {
        var features = this.state.map.catchmentLayer.features
          .filter(function (d) {
            return !filtered || vm.xf.hasCatchment(d.id);
          })
          .map(function (d) {
            var props = vm.xf.getCatchmentValue(d.id);

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

        var json = JSON.stringify(data);

        downloadFile(json, 'ice-sheds-catchments.geojson');

        this.setStatus();
      }.bind(this), 0);
    },
    downloadVariables: function () {
      var vm = this;
      this.setStatus('Downloading file...');
      setTimeout(function () {
        var variables = [];
        variables.push({
          id: this.dataset.config.columns.id,
          description: 'Catchment ID'
        });
        variables.push({
          id: this.dataset.config.columns.area,
          description: 'Area (sq km)'
        });
        this.dataset.config.variables.forEach(function (d) {
          variables.push({
            id: d.id,
            description: d.label
          });
        });

        var fields = ['id', 'description'];
        var csv = json2csv({data: variables, fields: fields});

        downloadFile(csv, 'ice-sheds-variables.csv');

        this.setStatus();
      }.bind(this), 0);
    },
    initializeUi: function () {
      // initialize share copy-to-clipboard button
      new Clipboard('.btn-copy');

      // initialize tooltips
      $('[data-toggle="tooltip"]').tooltip();

      // initialize resize
      $(window).resize(this.resizeWindow);
      this.resizeWindow();

      // sortable filters
      $('.ice-filter-container').sortable({
        items: '.ice-filter',
        axis: 'y',
        handle: '.title'
      });
    },
    resizeWindow: function () {
      console.log('app:resizeWindow()');
      $('.ice-filter-container').css('max-height', ($(window).height() - 185) + "px");
    },
    serializeUrl: function () {
      var query = {};

      query.configUrl = this.state.configUrl;

      query.variable = this.state.variable;
      query.layer = this.state.layer;

      query.filters = {};
      query.filters.regions = ['stusps'].map(function (id) {
        return {
          id: id,
          values: this.state.filters.regions[id]
        }
      }.bind(this));

      query.filters.charts = this.state.xf.filters.map(function (filter) {
        return {
          id: filter.id,
          range: filter.range
        };
      });

      query.selected = {};
      if (this.state.selected.aggregation) {
        query.selected.aggregation = this.state.selected.aggregation.id;

        if (this.state.map.catchmentLayer) {
          query.catchments = true;

          if (this.state.selected.catchment) {
            query.selected.catchment = this.state.selected.catchment.id;
          }
        }
      }

      query.map = {
        view: {
          center: this.state.map.view.center,
          zoom: this.state.map.view.zoom
        },
        showUnselectedAggregation: this.state.map.showUnselectedAggregation
      };

      // stringify nested objects
      ['filters', 'map', 'selected'].forEach(function (key) {
        query[key] = JSON.stringify(query[key]);
      })

      return queryString.stringify(query);
    },
    validateUrl: function (config) {
      console.log('app:validateUrl()', config);

      var vm = this,
          query = this.dataset.query;

      var schema = Joi.object().keys({
        configUrl: Joi.string().uri({allowRelative: true}),
        variable: Joi.string().valid(
          config.variables
            .filter(function (d) { return d.aggregation; })
            .map(function (d) { return d.id; })
            .concat(['*area'])
        ),
        layer: Joi.string().valid(
          config.layers.map(function (d) { return d.id; })
        ),
        filters: Joi.object().keys({
          regions: Joi.array().items(
            Joi.object().keys({
              id: Joi.string().valid(
                config.regions.map(function (d) { return d.id; })
              ),
              values: Joi.array()
            })
          ),
          charts: Joi.array().items(
            Joi.object().keys({
              id: Joi.string().valid(
                config.variables
                  .filter(function (d) { return d.filter; })
                  .map(function (d) { return d.id; })
              ).required(),
              range: Joi.array().length(2).items(
                Joi.number()
              ).optional()
            })
          )
        }),
        map: Joi.object().keys({
          view: Joi.object().keys({
            center: Joi.array().length(2).items(
              Joi.number().min(-180).max(180)
            ),
            zoom: Joi.number().integer().min(5).max(18)
          }),
          showUnselectedAggregation: Joi.boolean()
        }),
        selected: Joi.object().keys({
          aggregation: Joi.string(),
          catchment: Joi.string()
        }),
        catchments: Joi.boolean()
      });

      return new Promise(function (resolve, reject) {
        if (!query) return resolve(config);

        var result = Joi.validate(query, schema);

        if (result.error) {
          return reject(new Error('Invalid URL\n\n' + result.error.message));
        }
        return resolve(result.value);
      })
    },
    deserializeUrl: function (query) {
      if (!query) return;

      var parsed = queryString.parse(query);

      return parsed;
    },
    showUnselectedAggregation: function (show) {
      // console.log('app:showUnselectedAggregation(%s)', show);
      this.state.map.showUnselectedAggregation = show;
    }
  }
})
