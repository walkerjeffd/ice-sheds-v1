var L = require('leaflet');

L.Control.Transparency = L.Control.extend({
  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'ice-map-control-transparency');

    var slider = L.DomUtil.create('div', 'ice-map-control-transparency-slider', container);
    slider.style.height = '100px';

    $(slider).slider({
      orientation: 'vertical',
      range: 'max',
      value: 100,
      min: 0,
      max: 100,
      start: function (event, ui) {
        map.dragging.disable();
      },
      slide: function(event, ui) {
        var opacity = (+ui.value) / 100;

        d3.select(map.getPanes().overlayPane)
          .select('svg')
          .attr('opacity', opacity);
      },
      stop: function (event, ui) {
        map.dragging.enable();
      }
    });

    return container;
  }
});

L.control.transparency = function (opts) {
  return new L.Control.Transparency(opts);
};
