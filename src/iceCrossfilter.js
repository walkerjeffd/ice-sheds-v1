var crossfilter = require('crossfilter');

module.exports = function (data) {
  var xf = {}, _dims = {}, _data, _areaColumn;

  xf.data = function (_) {
    if (!arguments.length) return _data;
    _data = _;
    loadData(_data);
    return xf;
  }

  xf.areaColumn = function (_) {
    if (!arguments.length) return _areaColumn;
    _areaColumn = _;
    return xf;
  }

  xf.setAggregation = function (byColumn, valueColumn) {
    console.log('xf:setAggregation()', byColumn, valueColumn);

    if (!_areaColumn) {
      console.error('Missing area column in IceCrossfilter');
      return;
    }

    xf.agg = {};
    xf.agg.dim = xf.ndx.dimension(function (d) {
      return d[byColumn];
    });

    xf.agg.group = xf.agg.dim.group().reduce(
      function reduceAdd(p, v) {
        if (v[valueColumn] !== null) {
          p.count += 1;
          p.sum += v[valueColumn]*v[_areaColumn];
          p.area += v[_areaColumn];
          p.mean = p.count >= 1 ? p.sum/p.area : null;
        }
        return p ;
      },
      function reduceRemove(p, v) {
        if (v[valueColumn] !== null) {
          p.count -= 1;
          p.sum -= v[valueColumn]*v[_areaColumn];
          p.area -= v[_areaColumn];
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

  xf.addDim = function (id) {
    var dim = _dims[id] = {};

    dim.id = id;
    dim.filter = undefined;
    dim.dimension = xf.ndx.dimension(function(d) {
      return d[dim.id];
    });
    dim.group = dim.dimension.group().reduceCount();

    return xf;
  }

  xf.setFilter = function (id, filter) {
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

  xf.getAggregationValue = function (id) {
    return xf.agg.values[id];
  }

  function loadData (data) {
    console.log('xf:loadData() length=' + data.length);
    xf.dims = {};
    xf.ndx = crossfilter(data);
    xf.all = xf.ndx.groupAll();

    return xf;
  }

  function updateValues() {
    console.log('xf:updateValues()');
    var dim = xf.agg;

    dim.group.all().forEach(function(d) {
      dim.values[d.key] = d.value.count > 0 && d.value.area > 0 ? d.value.mean : null;
    });
  }

  return xf;
}