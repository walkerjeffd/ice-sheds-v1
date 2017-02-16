var crossfilter = require('crossfilter');

module.exports = function (data) {
  var xf = {}, _dims = {}, _data, _area, _idColumn, _stats, _features = {};

  xf.data = function (_) {
    // get/set dataset
    if (!arguments.length) return _data;
    _data = _;
    loadData(_data);
    return xf;
  }

  xf.idColumn = function (_) {
    // get/set catchment id column
    if (!arguments.length) return _idColumn;
    _idColumn = _;
    return xf;
  }

  xf.areaColumn = function (_) {
    // get/set catchment area column
    if (!arguments.length) return _area;
    _area = _;
    return xf;
  }

  xf.setAggregation = function (key, value) {
    // set aggregation dimension
    // key: aggregation key (e.g. huc8)
    // value: aggregation variable (e.g. elevation)
    console.log('xf:setAggregation(%s, %s)', key, value);

    if (xf.agg && xf.agg.dim) {
      xf.agg.dim.dispose();
      xf.agg.group.dispose();
    }

    if (!_area) {
      console.error('Missing area column in IceCrossfilter');
      return;
    }

    xf.agg = {};
    xf.agg.key = key;
    xf.agg.dim = xf.ndx.dimension(function (d) {
      return d[key];
    });

    xf.agg.group = xf.agg.dim.group().reduce(
      function reduceAdd(p, v) {
        if (v[value] !== null) {
          p.count += 1;
          p.sum += v[value]*v[_area];
          p.area += v[_area];
          p.mean = p.count >= 1 ? p.sum/p.area : null;
        }
        return p ;
      },
      function reduceRemove(p, v) {
        if (v[value] !== null) {
          p.count -= 1;
          p.sum -= v[value]*v[_area];
          p.area -= v[_area];
          p.mean = p.count >= 1 ? p.sum/p.area : null;
        }
        return p;
      },
      function reduceInit(p, v) {
        return { count: 0, sum: 0, area: 0, mean: 0 };
      }
    );

    xf.agg.values = {};

    updateValues();

    return xf;
  }

  xf.getAggregationValue = function (id) {
    // get aggregation value for aggregation feature id
    return xf.agg.values[id];
  }

  xf.setAggFilter = function (id) {
    if (id) {
      xf.agg.dim.filter(id);
    } else {
      xf.agg.dim.filterAll();
    }
  }

  xf.getCatchmentValue = function (id, key) {
    // get catchment value by catchment id
    // id: catchment id
    // key: (optional) variable key, if undefined returns catchment object
    return key ? _features.map.get(id)[key] : _features.map.get(id);
  }

  xf.hasCatchment = function (id) {
    // is catchment in filter(s)
    return _features.set.has(id);
  }

  xf.addCategoricalDim = function (id) {
    var dim = _dims[id] = {};

    dim.id = id;
    dim.filter = undefined;
    dim.dimension = xf.ndx.dimension(function(d) {
      return d[dim.id];
    });
    dim.group = dim.dimension.group().reduceCount();

    return xf;
  }

  xf.setCategoricalDimFilter = function (id, filter) {
    var dim = _dims[id];

    if (!dim) {
      console.error('Unable to find dimension', id);
      return;
    }

    dim.filter = filter;
    dim.dimension.filter(function(d) {
      return dim.filter.indexOf(d) > -1;
    });
    updateValues();

    return xf;
  }

  xf.addFilterDim = function (id, variable) {
    console.log('xf:addFilterDim(%s)', id);

    if (_dims[id]) {
      console.error('filterDim already exists:', id);
      return;
    }

    var dim = _dims[id] = {};

    dim.dimension = xf.ndx.dimension(function(d) {
      return d[id] === null ? -1 : d[id];
    });

    dim.group = dim.dimension.group(function(d) {
      return d >= variable.max ? variable.max - variable.interval : Math.floor(d/variable.interval) * variable.interval;
    });

    return xf;
  }

  xf.removeFilterDim = function (id) {
    console.log('xf:removeFilterDim(%s)', id);

    if (!_dims[id]) {
      console.error('filterDim does not exist:', id);
      return;
    }

    var dim = _dims[id];

    dim.dimension.dispose();
    dim.group.dispose();
    delete _dims[id];

    updateValues();

    return xf;
  }

  xf.setFilterDimRange = function (id, range) {
    // console.log('xf:setFilterDim()', id);

    var dim = _dims[id];

    if (!dim) {
      console.error('Unable to find filter dim:', id);
    }

    if (range) {
      dim.dimension.filterRange(range);
    } else {
      dim.dimension.filterAll();
    }

    updateValues();

    return xf;
  }

  xf.getDim = function (id) {
    return _dims[id];
  }

  xf.destroy = function () {
    var keys = Object.keys(_dims);

    keys.forEach(function (key) {
      xf.removeFilterDim(key);
    })

    if (xf.agg && xf.agg.dim) {
      xf.agg.dim.dispose();
      xf.agg.group.dispose();
    }

    xf.all.dispose();
  }

  xf.updateStats = function (key, variables) {
    // compute area weighted mean of all variables by column key
    console.log('xf:updateStats(%s)', key, variables);

    var areaKey = _area,
        data = _data;

    var variableKeys = variables.map(function(d) { return d.id; })

    var ndx = crossfilter(data);
    var dim = ndx.dimension(function (d) {
      return d[key];
    });

    var group = dim.group().reduce(
      function reduceAdd(p, v) {
        p.area += v[areaKey];
        p.count += 1;
        variableKeys.forEach(function (key) {
          if (v[key] != null) {
            p.variables[key].count += 1;
            p.variables[key].area += v[areaKey];
            p.variables[key].sum += v[key]*v[areaKey];
            p.variables[key].mean = p.variables[key].count >= 1 ? p.variables[key].sum/p.variables[key].area : null;
          }
        });
        return p ;
      },
      function reduceRemove(p, v) {
        p.area -= v[areaKey];
        p.count -= 1;
        variableKeys.forEach(function (key) {
          if (v[key] != null) {
            p.variables[key].count -= 1;
            p.variables[key].area -= v[areaKey];
            p.variables[key].sum -= v[key]*v[areaKey];
            p.variables[key].mean = p.variables[key].count >= 1 ? p.variables[key].sum/p.variables[key].area : null;
          }
        });
        return p;
      },
      function reduceInit(p, v) {
        var variableKeys = variables.map(function(d) { return d.id; }),
            initial = {};

        initial.area = 0;
        initial.count = 0;
        initial.variables = {};
        variableKeys.forEach(function (key) {
          initial.variables[key] = {
            count: 0,
            area: 0,
            sum: 0,
            mean: 0
          };
        });
        return initial;
      }
    );


    _stats = {};
    group.all().forEach(function(d) {
      _stats[d.key] = d.value;
    });

    dim.dispose();
    group.dispose();
    delete ndx;

    console.log('xf:updateStats(%s) done', key);
  }

  xf.getFilteredCount = function () {
    return xf.all ? xf.all.value() : 0;
  }

  xf.getStatsById = function (id) {
    return _stats[id];
  }

  function loadData (data) {
    console.log('xf:loadData(n=%s)', data.length);
    xf.ndx = crossfilter(data);
    xf.all = xf.ndx.groupAll();

    _features.map = d3.map(data, function (d) { return d[_idColumn]; });
    _features.set = d3.set(data.map(function (d) { return d[_idColumn]; }));

    _features.group = xf.all.reduce(
      function reduceAdd(p, v) {
        p += 1;
        _features.set.add(v[_idColumn]);
        return p;
      },
      function reduceRemove(p, v) {
        p -= 1;
        _features.set.remove(v[_idColumn]);
        return p;
      },
      function reduceInit(p, v) {
        return 0;
      }
    );

    return xf;
  }

  function updateValues() {
    // console.log('xf:updateValues()');
    if (!xf.agg) return;
    var dim = xf.agg;

    dim.group.all().forEach(function(d) {
      dim.values[d.key] = d.value.count > 0 && d.value.area > 0 ? d.value.mean : null;
    });
  }

  return xf;
}