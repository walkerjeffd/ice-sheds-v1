module.exports = {
  props: ['feature'],
  template: '<div class="ice-select-info catchment text-right">' +
      '<div class="ice-select-info-title"><strong>Selected Catchment:</strong> <span>{{feature.id}}</span></div>' +
      '<div class="btn-group btn-group-xs" style="margin-top:5px">' +
        '<button class="btn btn-default disabled"><i class="fa fa-info"></i> Info</button>' +
        '<button class="btn btn-default" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
      '</div>' +
    '</div>',
  methods: {
    unselect: function () {
      console.log('select-info:unselect()');
      this.$emit('unselect');
    }
  }
};
