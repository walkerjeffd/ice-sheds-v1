var crossfilter = require('crossfilter');

module.exports = function (data) {
  var xf = {}, _dims = {}, _data, _area;

  xf.data = function (_) {
    if (!arguments.length) return _data;
    _data = _;
    loadData(_data);
    return xf;
  }

  xf.areaColumn = function (_) {
    if (!arguments.length) return _area;
    _area = _;
    return xf;
  }

  xf.setAggregation = function (key, value) {
    console.log('xf:setAggregation()', key, value);

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
  }

  xf.getAggregationValue = function (id) {
    return xf.agg.values[id];
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
    console.log('xf:addFilterDim()', id);

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
    console.log('xf:removeFilterDim()', id);

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

  function loadData (data) {
    console.log('xf:loadData() length=' + data.length);
    xf.ndx = crossfilter(data);
    xf.all = xf.ndx.groupAll();

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