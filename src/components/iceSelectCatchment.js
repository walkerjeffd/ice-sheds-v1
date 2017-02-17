module.exports = {
  props: ['feature'],
  template: '<div class="ice-select-box catchment text-right">' +
      '<div class="ice-select-box-title"><strong>Selected Catchment:</strong> <span>{{feature.id}}</span></div>' +
      '<div class="ice-select-box-body">' +
        '<button class="btn btn-default btn-xs pull-left" @click="info"><i class="fa fa-info"></i> Info</button>' +
        '<button class="btn btn-default btn-xs pull-right" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
      '</div>' +
    '</div>',
  methods: {
    unselect: function () {
      this.$emit('unselect');
    },
    info: function () {
      this.$emit('info', this.feature);
    }
  }
};
