var Vue = require('vue'),
    Promise = require('bluebird'),
    topojson = require('topojson-client'),
    queryString = require('query-string');

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
        // histogram chart filters
        charts: {
          config: {
            selectedTextFormat: 'count',
            countSelectedText: '{0} variables selected'
          },
          options: []
        },
        // region select filters
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
      regions: [
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
          max: 1000,
          scale: 1,
          interval: 25,
          format: ',.1f'
        }, {
          id: "forest",
          label: "Forest Cover (%)",
          aggregation: true,
          filter: true,
          min: 0,
          max: 1,
          scale: 100,
          interval: 0.025,
          format: '%'
        }, {
          "id": "agriculture",
          "label": "Agriculture Cover (%)",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 1,
          "interval": 0.025,
          "scale": 100,
          "format": "%"
        }, {
          "id": "summer_prcp_mm",
          "label": "Mean Summer Precip (mm/mon)",
          "aggregation": true,
          "filter": true,
          "min": 70,
          "max": 230,
          "interval": 4,
          "scale": 1,
          "format": ",.1f"
        }, {
          "id": "meanSummerTemp",
          "label": "Mean Summer Temp (C)",
          "aggregation": true,
          "filter": true,
          "min": 14,
          "max": 24,
          "interval": 0.25,
          "scale": 1,
          "format": ",.1f"
        }, {
          "id": "meanDays_18",
          "label": "Mean Days per Year > 18 C",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 240,
          "interval": 6,
          "scale": 1,
          "format": ",.1f"
        }, {
          "id": "meanDays_22",
          "label": "Mean Days per Year > 22 C",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 60,
          "interval": 1.5,
          "scale": 1,
          "format": ",.0f"
        }, {
          "id": "occ_current",
          "label": "Probability of Brook Trout Occupancy",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 1,
          "interval": 0.025,
          "scale": 1,
          "format": "%"
        }, {
          "id": "max_temp_0_3",
          "label": "Threshold Temp (C) for 30% Occupancy",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 6,
          "interval": 0.15,
          "scale": 1,
          "format": ".2f"
        }, {
          "id": "max_temp_0_5",
          "label": "Threshold Temp (C) for 50% Occupancy",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 6,
          "interval": 0.15,
          "scale": 1,
          "format": ".2f"
        }, {
          "id": "max_temp_0_7",
          "label": "Threshold Temp (C) for 70% Occupancy",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 6,
          "interval": 0.15,
          "scale": 1,
          "format": ".2f"
        }, {
          "id": "plus2",
          "label": "Occupancy Prob with 2 C Incr. in July Temp",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 1,
          "interval": 0.025,
          "scale": 1,
          "format": "%"
        }, {
          "id": "plus4",
          "label": "Occupancy Prob with 4 C Incr. in July Temp",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 1,
          "interval": 0.025,
          "scale": 1,
          "format": "%"
        }, {
          "id": "plus6",
          "label": "Occupancy Prob with 6 C Incr. in July Temp",
          "aggregation": true,
          "filter": true,
          "min": 0,
          "max": 1,
          "interval": 0.025,
          "scale": 1,
          "format": "%"
        }
      ]
    },
    state: {
      message: 'Initializing...',
      layer: 'huc8',
      variable: 'forest',
      filters: {
        charts: ['forest'],
        region: ['CT', 'DE', 'DC', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT', 'VA', 'WV']
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

    var queryState = deserializeState(location.search);
    vm.setState(queryState);

    if (queryState && queryState.map && queryState.map.view) {
      if (queryState.map.view.center) {
        vm.state.map.view.center = queryState.map.view.center;
      }
      if (queryState.map.view.zoom) {
        vm.state.map.view.zoom = queryState.map.view.zoom;
      }
    }

    vm.xf = IceCrossfilter();

    // set up select picker options
    vm.config.layer.options = vm.dataset.layers.map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });
    vm.config.variable.options = vm.dataset.variables.filter(function (d) {
        return d.aggregation;
      }).map(function (d) {
        return {
          id: d.id,
          label: d.label
        };
      });
    vm.config.filters.region.options = vm.dataset.regions.map(function (d) {
      return {
        id: d.id,
        label: d.label
      };
    });
    vm.config.filters.charts.options = vm.dataset.variables.filter(function (d) {
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
        vm.xf.addCategoricalDim('stusps');
        vm.selectVariable(vm.state.variable);
        vm.selectStates(vm.state.filters.region);
        vm.selectFilters(vm.state.filters.charts);

        if (queryState && queryState.filters && queryState.filters.charts) {
          queryState.filters.charts.forEach(function (filter) {
            filter.range && vm.setFilter(filter.id, filter.range);
          });
        }

        vm.state.map.getColor = function (id) {
          var value = vm.xf.getAggregationValue(id);
          return value === null ? '#EEE' : vm.state.map.colorScale(value);
        };
      })
      .then(function () {
        return vm.selectLayer(vm.state.layer);
      })
      .catch(function (err) {
        console.error(err);
        alert('Unable to initialize');
      });
  },
  methods: {
    setMapView: function (center, zoom) {
      if (center) this.state.map.view.center = center;
      if (zoom) this.state.map.view.zoom = zoom;
    },
    setState: function (newState) {
      if (!newState) return;

      var state = this.state;

      state.variable = newState.variable || state.variable;
      state.layer = newState.layer || state.layer;
      state.variable = newState.variable || state.variable;
      if (newState.filters) {
        state.filters.region = newState.filters.region || state.filters.region;

        if (newState.filters.charts) {
          state.filters.charts = newState.filters.charts.map(function (d) { return d.id; });
        }
      }
    },
    addFilter: function (id, range) {
      console.log('app:addFilter()', id);
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
      return this.dataset.variables.filter(function (d) {
        return d.id == id;
      })[0]
    },
    fetchDataset: function (dataset) {
      console.log('app:fetchDataset()', dataset);
      var vm = this;

      vm.setStatus('Loading dataset...');
      return new Promise(function (resolve, reject) {
        d3.csv(dataset.url, function(err, data) {
          if (err) return reject(err);

          data.forEach(function(d) {
            dataset.variables.forEach(function(v) {
              d[v.id] = d[v.id] === "" ? null : +d[v.id]/v.scale;
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
          vm.addFilter(filter);
        }
      });

      this.state.filters.charts = filters;
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
      this.xf.setCategoricalDimFilter('stusps', states);
      if (this.state.selected) this.state.selected.xf.setCategoricalDimFilter('stusps', states);

      this.state.filters.region = states;
      this.$set(this.state.xf, 'stusps', states);
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
        xf.addCategoricalDim('stusps').setCategoricalDimFilter('stusps', this.state.filters.region);

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
      var query = serializeState(this.state);
      console.log(location.origin + location.pathname + '?' + query);
    },
    updateAggregation: function (layer, variable) {
      console.log('app:updateAggregation()', layer, variable);
      this.state.layer = layer;
      this.state.variable = variable;
      this.xf.setAggregation(this.state.layer, this.state.variable);
    }
  }
})
