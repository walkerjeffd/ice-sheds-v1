var crossfilter = require('crossfilter');

module.exports = function (data) {
  var xf = {}, _data, areaColumn;

  xf.data = function (_) {
    if (!arguments.length) return _data;
    _data = _;
    loadData(_data);
    return xf;
  }

  xf.areaColumn = function (_) {
    if (!arguments.length) return areaColumn;
    areaColumn = _;
    return xf;
  }

  xf.setAggregation = function (byColumn, valueColumn) {
    console.log('xf:setAggregation()', byColumn, valueColumn);

    if (!areaColumn) {
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
          p.sum += v[valueColumn]*v[areaColumn];
          p.area += v[areaColumn];
          p.mean = p.count >= 1 ? p.sum/p.area : null;
        }
        return p ;
      },
      function reduceRemove(p, v) {
        if (v[valueColumn] !== null) {
          p.count -= 1;
          p.sum -= v[valueColumn]*v[areaColumn];
          p.area -= v[areaColumn];
          p.mean = p.area >= 0 ? p.sum/p.area : null;
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