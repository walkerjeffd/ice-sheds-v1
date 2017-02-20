module.exports = {
  props: ['feature'],
  template: '<div class="ice-select-box catchment text-right">' +
      '<div class="ice-select-box-title"><strong>Selected Catchment:</strong> <span>{{feature.id}}</span></div>' +
      '<div class="ice-select-box-body">' +
        '<button class="btn btn-default btn-xs pull-left" @click="data"><i class="fa fa-table"></i> Data</button>' +
        '<button class="btn btn-default btn-xs pull-left" @click="zoom"><i class="fa fa-search-plus"></i> Zoom To</button>' +
        '<button class="btn btn-default btn-xs pull-right" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
      '</div>' +
    '</div>',
  methods: {
    unselect: function () {
      this.$emit('unselect');
    },
    data: function () {
      this.$emit('data', this.feature);
    },
    zoom: function () {
      this.$emit('zoom', this.feature);
    }
  }
};
