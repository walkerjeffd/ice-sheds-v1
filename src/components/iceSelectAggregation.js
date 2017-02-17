module.exports = {
  props: ['featureType', 'feature'],
  template: '<div class="ice-select-box aggregation text-right">' +
      '<div class="ice-select-box-title"><strong>Selected {{featureType}}:</strong> <span>{{featureLabel}}</span></div>' +
      '<div class="ice-select-box-body">' +
        '<button class="btn btn-default btn-xs pull-left" @click="info"><i class="fa fa-info"></i> Info</button>' +
        '<button class="btn btn-default btn-xs pull-left" @click="catchments"><i class="fa fa-search-plus"></i> Catchments</button>' +
        '<button class="btn btn-default btn-xs pull-right" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
      '</div>' +
    '</div>',
  computed: {
    featureLabel: function () {
      if (!this.feature) {
        return 'none';
      }

      return this.feature.id + ' | ' + this.feature.properties.name;
    }
  },
  methods: {
    unselect: function () {
      this.$emit('unselect');
    },
    catchments: function () {
      this.$emit('catchments', this.feature);
    },
    info: function () {
      this.$emit('info', this.feature);
    }
  }
};
